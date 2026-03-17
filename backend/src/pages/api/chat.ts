import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { getSystemPrompt } from '@/lib/chatbotPrompts'; 
import { User, WorkSession, Group, ElectiveVacation, YearlyVacationDays } from '@/models'; 

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LLAMA_MODEL = process.env.LLAMA_MODEL || "llama-3.1-8b-instant";
const MONGODB_URI = process.env.MONGODB_URI;

let cached = (global as any).mongoose;
if (!cached) cached = (global as any).mongoose = { conn: null, promise: null };

async function connectDB() {
  if (!MONGODB_URI) throw new Error("⚠️ MONGODB_URI no definit al .env");
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const opts = { bufferCommands: false };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => mongoose);
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}

function getTimeContext(): string {
  const now = new Date();
  return `Data actual: ${now.toLocaleDateString('ca-ES', { timeZone: 'Europe/Madrid' })} (${now.toLocaleTimeString('ca-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}).`;
}

import { responseError } from '@/lib/response-error-generator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return responseError(res, 405, 'MethodNotAllowed');

  try {
    if (!GROQ_API_KEY) return responseError(res, 500, 'GroqApiKeyMissing');
    
    const { message, lang = "ca", email, history = [] } = req.body;
    if (!message) return responseError(res, 400, 'MessageMissing');

    let dbContext = "No tinc dades.";
    
    if (email) {
      try {
        await connectDB();
        const currentUser = await User.findOne({ email });
        
        if (currentUser) {
          const isAdmin = currentUser.role === 'admin' || email.includes('admin'); 
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const currentYear = new Date().getFullYear();

          // 1. CARREGAR GRUPS I USUARIS
          const allGroups = await Group.find({}, '_id name');
          const groupsMap: Record<string, string> = {};
          const allGroupNames = allGroups.map((g: any) => g.name).join(', ');

          allGroups.forEach((g: any) => { groupsMap[g._id.toString()] = g.name; });

          const allUsers = await User.find({}, 'name email groups role'); 
          const usersMap = allUsers.reduce((acc: any, u: any) => {
              acc[u._id.toString()] = { 
                  name: u.name || u.email.split('@')[0], 
                  email: u.email,
                  groups: u.groups || [], 
                  role: u.role
              };
              return acc;
          }, {});

          // 2. FILTRE DE SEGURETAT
          let visibleUserIds: string[] = [];
          
          if (isAdmin) {
              visibleUserIds = allUsers.map((u: any) => u._id.toString());
          } else {
              const myGroupIds = currentUser.groups ? currentUser.groups.map((id: any) => id.toString()) : [];
              
              if (myGroupIds.length === 0) {
                  visibleUserIds = [currentUser._id.toString()];
              } else {
                  visibleUserIds = allUsers
                      .filter((u: any) => {
                          if (!u.groups || u.groups.length === 0) return u._id.toString() === currentUser._id.toString();
                          return u.groups.some((gId: any) => myGroupIds.includes(gId.toString()));
                      })
                      .map((u: any) => u._id.toString());
              }
          }

          // DADES FILTRADES (Només el que l'usuari pot veure)
          const visibleUsers = allUsers.filter((u: any) => visibleUserIds.includes(u._id.toString()));

          // 3. GENERAR RESUM DE GRUPS ACCESSIBLES
          const myGroupsSummary: Record<string, string[]> = {};
          
          visibleUsers.forEach((u: any) => {
             const userGroups = u.groups && u.groups.length > 0 
                ? u.groups.map((gid: any) => groupsMap[gid.toString()] || null).filter(Boolean)
                : ["Sense Grup"];
             
             userGroups.forEach((groupName: string) => {
                 if (groupName) {
                    if (!myGroupsSummary[groupName]) myGroupsSummary[groupName] = [];
                    myGroupsSummary[groupName].push(u.name);
                 }
             });
          });

          const llistaElsMeusGrups = Object.keys(myGroupsSummary).length > 0 
            ? Object.entries(myGroupsSummary).map(([grup, membres]) => {
                return `GRUP [${grup}]: ${membres.join(', ')}`;
              }).join('\n')
            : "No pertanys a cap grup o no tens companys visibles.";


          // DETALLS INDIVIDUALS (FILTRATS)
          const llistaDirectori = visibleUsers.map((u: any) => {
             const nomsGrupsReals = (u.groups && u.groups.length > 0)
                ? u.groups.map((gId: any) => groupsMap[gId.toString()] || null).filter(Boolean).join(', ')
                : "Sense Grup";
             return `- ${u.name} (${u.email}) -> Grups: [${nomsGrupsReals}]`;
          }).join('\n');


          // ------------------------------------------------------------------
          // BLOC B MILLORAT: REGISTRE JORNADA I ESTAT ACTUAL
          // ------------------------------------------------------------------
          const allSessions = await WorkSession.find({
            timestamp: { $gte: startOfDay },
            userId: { $in: visibleUserIds } 
          }).sort({ timestamp: 1 });

          // 1. Històric de moviments (Log)
          const llistaMoviments = allSessions.length > 0 
            ? allSessions.map((s: any) => {
                const userData = usersMap[s.userId.toString()];
                const nomUser = userData ? userData.name : "Desconegut";
                const accio = s.type === 'check_in' ? 'ENTRADA' : 'SORTIDA';
                const hora = new Date(s.timestamp).toLocaleTimeString('ca-ES', {timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit'});
                // IMPORTANT: Si està a visibleUsers, té permís per veure l'hora, no l'amaguem.
                return `- ${nomUser}: ${accio} a les ${hora}`;
              }).join('\n')
            : "Cap moviment registrat avui.";

          // 2. Càlcul d'Estat Actual (Snapshot)
          // Això és el que evita que el bot s'inventi coses. Li calculem nosaltres l'estat.
          const llistaEstatActual = visibleUsers.map((u: any) => {
             const userSessions = allSessions.filter((s: any) => s.userId.toString() === u._id.toString());
             // Com que hem ordenat per timestamp, l'últim és l'estat actual
             const lastSession = userSessions[userSessions.length - 1];
             
             let statusString = "";
             if (!lastSession) {
                 statusString = "⚪ NO HA FITXAT AVUI";
             } else if (lastSession.type === 'check_in') {
                 const hora = new Date(lastSession.timestamp).toLocaleTimeString('ca-ES', {timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit'});
                 statusString = `🟢 ACTIU (Treballant des de les ${hora})`;
             } else {
                 const hora = new Date(lastSession.timestamp).toLocaleTimeString('ca-ES', {timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit'});
                 statusString = `🔴 INACTIU (Ha sortit a les ${hora})`;
             }
             return `- ${u.name}: ${statusString}`;
          }).join('\n');

          // ------------------------------------------------------------------

          // BLOC C: SOL·LICITUDS PENDENTS
          const pendingVacations = await ElectiveVacation.find({
            userId: { $in: visibleUserIds },
            status: 'pending' 
          }).sort({ date: 1 });

          const llistaPendents = pendingVacations.length > 0
            ? pendingVacations.map((v: any) => {
                const nom = usersMap[v.userId.toString()]?.name || "User";
                const dataV = new Date(v.date).toLocaleDateString('ca-ES');
                return `- 🔴 PENDENT: ${nom} pel dia ${dataV}. Motiu: "${v.reason || '-'}"`;
            }).join('\n')
            : "✅ No hi ha cap sol·licitud pendent.";

          // BLOC D: BALANÇ
          let llistaBalancVacances = "";
          if (isAdmin) {
            const allYearlyData = await YearlyVacationDays.find({ year: currentYear, userId: { $in: visibleUserIds } });
            const vacationMap = allYearlyData.reduce((acc: any, item: any) => { acc[item.userId.toString()] = item; return acc; }, {});
            const globalConfig = await YearlyVacationDays.findOne({ year: currentYear, userId: undefined });
            const defaultTotal = globalConfig ? globalConfig.electiveDaysTotalCount : 22;

            llistaBalancVacances = visibleUsers.map((u: any) => {
                const vData = vacationMap[u._id.toString()];
                const total = vData ? vData.electiveDaysTotalCount : defaultTotal;
                const gastats = vData ? vData.selectedElectiveDays.length : 0;
                return `- ${u.name}: Queden ${total - gastats} dies.`;
            }).join('\n');
          } else {
             const myInfo = await YearlyVacationDays.findOne({ userId: currentUser._id, year: currentYear });
             const total = myInfo ? myInfo.electiveDaysTotalCount : 22;
             const gastats = myInfo ? myInfo.selectedElectiveDays.length : 0;
             llistaBalancVacances = `Tens ${total - gastats} dies disponibles.`;
          }

          // ------------------------------------------------------------------
          // CONTEXT FINAL
          // ------------------------------------------------------------------
          dbContext = `
${getTimeContext()}
Usuari actual: ${currentUser.name} (${isAdmin ? 'ADMIN' : 'EMPLEAT'})

[LLISTA DE TOTS ELS GRUPS (NOMS)]
${allGroupNames}

[DETALL DELS TEUS GRUPS (MEMBRES)]
${llistaElsMeusGrups}

[ESTAT ACTUAL DELS EMPLEATS VISIBLES (RESUM)]
(Fes servir aquesta llista per respondre "Qui està treballant?" o "Quin és l'estat de X?")
${llistaEstatActual}

[REGISTRE DE MOVIMENTS D'AVUI (DETALL)]
${llistaMoviments}

[DIRECTORI D'USUARIS VISIBLES]
${llistaDirectori}

[SOL·LICITUDS VACANCES PENDENTS]
${llistaPendents}

[SALDO DE VACANCES]
${llistaBalancVacances}

INSTRUCCIONS:
1. Per saber si algú treballa, mira EXCLUSIVAMENT la secció [ESTAT ACTUAL DELS EMPLEATS]. No intentis deduir-ho tu.
2. Si un usuari té l'estat "⚪ NO HA FITXAT AVUI", digues exactament això.
3. Si un usuari demana informació d'un grup que NO està a [DETALL DELS TEUS GRUPS], respon: "No puc proporcionar informació sobre altres grups als quals no pertanys."
          `;
        }
      } catch (dbError) {
        console.error("❌ Error DB:", dbError);
        dbContext = "Error tècnic.";
      }
    }

    const systemPrompt = getSystemPrompt(lang);
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLAMA_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "system", content: dbContext }, 
            ...history.slice(-4), 
            { role: "user", content: message }
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!response.ok) return responseError(res, 502, 'AiError');

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "No he entès la resposta.";

    res.status(200).json({ reply });

  } catch (error: any) {
    console.error("Error:", error);
    return responseError(res, 500, 'InternalError');
  }
}