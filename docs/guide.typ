#set par(justify: true)
#set text(font: "New Computer Modern", size: 11pt)
#set heading(numbering: "1.")
#set page(numbering: "1 / 1")
#let img = (source, width: 95%) => align(center)[
  #box(image(source, width: width), stroke: color.black)
]
#show link: underline
#show link: text.with(blue.darken(60%))

#align(center)[
  #text(20pt, weight: "bold")[
    #v(0.5em)
    Guia registre jornada
  ]
]

= Accions prèvies

== Activar un compte

Un administrador pot crear un nou compte per un nou usuari (administrador o empleat). Durant la creació, cal especificar el correu, nom i DNI (instruccions per a administrador més endavant). Després d'especificar aquests camps, s'envia un correu a l'adreça indicada automàticament anunciant que han sigut convidats a l'eina:

#img("pic/mail_reg.png", width: 80%)

Alternativament, també es pot compartir l'enllaç que es mostra al panell d'administració (és el mateix).

L'enllaç porta a la pàgina de registre, on s'estableix la contrasenya del compte, que fa que quedi activat. Aquest enllaç no s'ha de reutilitzar. A partir d'aquest moment, es pot accedir a l'eina iniciant sessió amb el correu + contrasenya.

== Reinici de contrasenya

Existeix el mètode clàssic d'enviar un correu electrònic per restablir la contrasenya. Aquesta acció també desbloqueja un compte que ha quedat bloquejat per haver intentat iniciar sessió amb la contrasenya incorrecta massa vegades seguides.

Es pot demanar restabliment de contrassenya des de la pàgina d'iniciar sessió.

== Afegir l'eina com a aplicació de mòbil

Per poder accedir ràpidament a l'eina de fitxatge, els navegadors de mòbil tenen 
l'opció d'afegir una pàgina web com una aplicació a la pantalla d'inici.
El primer pas, comú en tots els casos, és navegar a la pàgina desitjada
(en aquest cas, `nom-empresa.registrejornada.fyi`). Cal posar l'adreça del domini de la pàgina web completa al buscador (amb punts, sense espais. Mateix format que l'exemple que hi ha a la imatge següent), la pàgina web no surt a resultats de Google o similars.

#img("pic/url.png")

A la majoria de navegadors (Firefox, Chrome... exemple a la imatge de l'esquerra)
s'han de clicar els 3 punts verticals a dalt (o baix) a la dreta del tot per obrir
el menú que es veu, i buscar l'opció subratllada a la imatge o similar.

Pel cas de Safari (exemple a la imatge de la dreta), en comptes del menú de 3 punts,
s'ha d'obrir el menú de compartir la pàgina (encerclat en vermell). Allà apareixerà
l'opció per afegir la pàgina web com a aplicació/drecera a la pantalla d'inici.

#figure(
    grid(
        columns: 2,
        gutter: 2mm,
        img("pic/afegir_shortcut.jpeg", width: 80%),
        img("pic/afegir_shortcut_safari.jpeg", width: 80%),
    )
)


#pagebreak()

= Ús de l'eina

== Fitxar entrada i sortida

La utilitat principal de l'eina és el fitxatge d'entrada i sortida de la feina. A la primera pàgina, es pot indicar entrada/sortida, i incloure un motiu/observació opcional.

L'obligació legal de fitxar afecta gairebé totes les persones treballadores (art. 34.9 ET): només l'alta direcció (fora de l'àmbit de l'art. 1.3.c ET) n'està exempta.

#img("pic/fitxar.png")

Per diferenciar hores extra, cal que el botó estigui marcat abans de tancar la sessió.

#img("pic/hores_extra.png")

== Detecció d'anomalies i fitxatge automàtic

En cas d'haver oblidat de fitxar correctament (fitxar entrada però no sortida, o desviar-se de l'horari esperat), s'envia (si es té configurat a la configuració de l'empresa, sí per defecte) un correu avisant de l'anomalia.

#img("pic/mail_auto.png")

El recompte de l'horari no té en compte les hores extra.

Aquest correu inclou un enllaç per aplicar ràpidament el fitxatge automàtic. El fitxatge automàtic *substitueix* els temps d'entrada i sortida amb uns intervals de temps configurables pel propi empleat (a la primera pàgina), deixant marcat al registre que els temps guardats s'han generat d'aquesta manera i no marcant el botó d'entrada i sortida manualment. La intenció d'aquesta funció és poder arreglar ràpidament despistades pròpies.

#img("pic/horari_auto.png")

L'aplicació de fitxatge automàtic és compatible amb la llei: els sistemes d'auto-declaració són vàlids sempre que el registre continuï sent objectiu, fiable i accessible, i aquesta eina garanteix els tres requisits: les marques són generades i datades pel servidor, les modificacions queden versionades sense esborrar res, i la persona treballadora pot consultar el seu historial complet. Cal recordar que és possible modificar les hores que aplica el fitxatge automàtic abans d'aplicar-lo al dia corresponent.

== Historial i validació de dades mensuals

A la pestanya d'historial es poden veure els fitxatges d'entrada i sortida diaris, amb uns quants filtres disponibles. També s'indica amb una icona si les dades han sigut generades manualment (clicar entrada/sortida), amb el fitxatge automàtic, o si han sigut editades per un administrador.

Observeu la llegenda de colors i icones que es mostra dalt de la taula per entendre tota la informació inclosa.

#img("pic/historial.png")

Al final del mes, un cop un administrador hagi revisat els fitxatges, els empleats reben un correu demanant que confirmin els registres guardats d'un mes en concret:

#img("pic/mail_confirm.png")

Es recomana revisar les dades utilitzant la pàgina d'historial. Si s'està desacord amb alguna dada, cal comentar-ho amb responsables a través de medis de comunicació externs a l'eina.

Es pot confirmar des de la pàgina inicial (de fitxatge) quan hi ha un mes pendent per confirmar:

#img("pic/confirm.png")

L'estat de confirmacions mensuals es pot consultar al final de la pàgina d'historial:

#img("pic/history_confirm.png")

És obligatori per llei que les dades de fitxatge quedin confirmades pels empleats i per l'equip directiu. És per això que es demana fer una confirmació mútua de les dades al final de cada mes.

Un cop confirmats, no es poden modificar (a no ser que un administrador invalidi aquesta confirmació, cosa que requereix repetir el procés per tornar a bloquejar les dades). Els dies amb dades bloquejades apareixen més atenuats i amb una icona de candau a l'historial.

== Sol·licitud de vacances

Els administradors són responsables d'assignar els dies de vacances comuns de l'empresa (festius, vacances obligatòries) de cada any. A la pàgina de vacances es mostren tals dies com a "Festes de l'empresa".

A la pàgina de vacances és on es creen les sol·licituds de vacances de lliure elecció. Primer cal assegurar-se que l'any seleccionat és el correcte. Es mostren els dies de lliure elecció disponibles, gastats i totals de l'any, i hi ha un formulari per demanar un interval nou de vacances. Un cop especificat l'interval, apareix un indicador del nombre de vacances de lliure elecció que "costa" la sol·licitud, tenint en compte festius i dies no laborables.

#img("pic/solicitud_vacances.png")

L'estat de sol·licituds es pot veure al final de la pàgina, on també es poden cancel·lar les sol·licituds pendents. La negociació de vacances de lliure elecció s'ha de fer a través d'un medi extern a l'eina.

== Calendari i grups

A la pàgina de calendari es poden veure les vacances de tot tipus, a més dels registres diaris. Aquesta pàgina és útil si a l'empresa es creen grups. Com a empleat, pots veure les vacances d'altres empleats amb què comparteixis un grup (es poden visualitzar els grups als quals un usuari pertany a partir de la seva pàgina de perfil). La llegenda explica la codificació de colors.

#img("pic/calendar.png")

Es pot clicar un dia del calendari per veure la informació amb més detall. Es mostren els fitxatges d'aquell dia, a més de tota la informació relacionada amb vacances.

== Fitxers

Es pot accedir a la pàgina de fitxers de l'empleat a través de la pàgina de perfil. Consisteix en una llista de fitxers penjats per un administrador, que només el propi empleat i els administradors poden veure. La data del fitxer correspon a l'última edició (els administradors poden editar el nom i descripció d'un fitxer).

Un possible ús d'aquesta funció és compartir les nòmines mensuals.

#pagebreak()

= Dades emmagatzemades

Les dades estan emmagatzemades al servidor on s'executa el programa, i es fan còpies de seguretat
periòdiques. Les dades de l'empresa estan completament aïllades.

L'eina conserva:

- *Dades d'usuari* encriptant camps relacionats amb dades personals (correu electrònic i DNI).
- *Fitxatges* amb l'origen, l'estat i l'historial de versions; les correccions no esborren mai la versió anterior.
- *Vacances i permisos*: sol·licituds, estats i la configuració anual de festius i dies electius.
- *Confirmacions mensuals* i el seu historial (obertura, confirmació i revocació).
- *Fitxers* compartits i el registre de descàrregues.
- *Registre d'activitat*: qui ha fet què i quan.

Els usuaris eliminats no s'esborren de la base de dades: perden l'accés i deixen de ser visibles, però les seves dades es conserven i es poden restaurar.