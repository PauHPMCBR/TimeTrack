#set par(justify: true)
#set text(font: "New Computer Modern", size: 11pt)
#set heading(numbering: "1.")
#set page(numbering: "1 / 1")
#let img = (source, width: 95%) => align(center)[
  #box(image(source, width: width), stroke: color.black)
]

#align(center)[
  #text(20pt, weight: "bold")[
    #v(0.5em)
    Guia registre jornada
  ]
]

= Introducció

Durant tot el document, hi ha una separació de tipus d'usuaris de l'eina segons el seu rol:

- *Administrador* (o cap o responsable): normalment cap de l'empresa o similar. Té control de les dades de l'eina i no ha de fitxar registres.
- *Empleat* (o usuari "normal"): està obligat a fitxar per llei, no té permisos elevats a l'aplicació.


= Part comuna

== Activar un compte

Un administrador pot crear un nou compte per un nou usuari (administrador o empleat). Durant la creació, cal especificar el correu, nom i DNI (instruccions per a administrador més endavant). Després d'especificar aquests camps, s'envia un correu a l'adreça indicada automàticament anunciant que han sigut convidats a l'eina:

#img("pic/mail_reg.png")

Alternativament, també es pot compartir l'enllaç que es mostra al panell d'administració (és el mateix).

L'enllaç porta a la pàgina de registre, on s'estableix la contrasenya del compte, que fa que quedi activat. A partir d'aquest moment, es pot accedir a l'eina iniciant sessió amb el correu + contrasenya.

== Reinici de contrasenya

Existeix el mètode clàssic d'enviar un correu electrònic per restablir la contrasenya. Aquesta acció també desbloqueja un compte que ha quedat bloquejat per haver intentat iniciar sessió amb la contrasenya incorrecta massa vegades seguides.

== Afegir l'eina com a aplicació de mòbil

Per poder accedir ràpidament a l'eina de fitxatge, els navegadors de mòbil tenen l'opció d'afegir una pàgina web com una aplicació a la pantalla d'inici. Només cal navegar a la pàgina desitjada (en aquest cas, `nom-empresa.registrejornada.fyi`), obrir el menú (en el cas de la imatge, els 3 punts verticals a dalt a la dreta del tot obren el menú) i buscar l'opció subratllada a la imatge o similar.

#img("pic/afegir_shortcut.jpeg", width: 40%)

El procés pot ser una mica diferent en altres navegadors, com per exemple haver de clicar "compartir" perquè apareixi l'opció d'afegir la web a la pantalla d'inici.

#pagebreak()

= Empleats

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

= Administració

== Configuració global de l'empresa

Aquí es defineixen els valors generals de l'empresa, que els usuaris nous hereten en crear-se. Explicació de camps que poden causar certa confusió:

- *Tolerància*: marge (en minuts) abans de marcar una anomalia, un per a cada mode d'expectativa. La d'*hores esperades* compara el total d'hores treballades amb les esperades; la d'*horari per dies* compara cada fitxatge amb l'horari esperat. Per exemple, per a un empleat que ha de treballar 8h i una tolerància d'1h, "6h 30m" de treball és una anomalia, però "7h" no (i "8h 30m" tampoc, i "9h 01m" sí).

- *Hora de fi de dia*: hora límit a partir de la qual s'avisa per correu els empleats amb fitxatges inconsistents.

- *Consulta prèvia a la representació dels treballadors*: cal marcar-la un cop consultada la representació abans d'implantar el registre de jornada (art. 34.9 ET).

També s'hi configura l'*avís de privadesa* (RGPD) que veuen els empleats en registrar-se i des del seu perfil.

== Gestió d'usuaris i grups

A la pàgina d'empleats es mostren tots els usuaris (empleats i administradors) amb el seu estat (treballant ara, registrat, activació pendent o compte bloquejat). Des d'aquí es creen usuaris, s'editen, es restableix la contrasenya i s'exporten dades.

Un compte bloquejat es desbloqueja restablint-ne la contrasenya (botó *Invalidar contrasenya*), cosa que obliga l'empleat a recuperar-la pel procediment de contrasenya oblidada.

Els usuaris eliminats perden l'accés a l'eina, pero les seves dades no s'esborren. Es poden restaurar usuaris eliminats sempre que no hi hagi col·lisió amb altres usuaris actius. Els administradors no es poden eliminar.

Aneu en compte en elevar el rol d'un usuari a administrador: aquest canvi no el pot desfer un administrador, per tant cal contactar amb suport tècnic per desfer-lo si es tracta d'una errada.

Els *grups* (o departaments) agrupen empleats i determinen la visibilitat: un empleat pot veure les vacances i el perfil dels usuaris amb qui comparteix grup.

== Resoldre anomalies de fitxatges i petició de confirmació mensual

La pàgina de fitxatges de l'administrador mostra els registres de tots els empleats amb detecció d'anomalies, amb el mateix format que la pàgina "Historial" d'un empleat, però amb les dades de tots els usuaris.

Es detecta com a "anomalia" qualsevol temps de fitxatge que es desvii de l'horari esperat (equivalent amb temps i temps esperat) per més de la tolerància especificada. També es detecta com a anomalia si el nombre de sessions no correspon amb l'esperat (de més o de menys). En particular, treballar durant un dia no laborable (incloent vacances o baixes) es considera anomalia.

Clicant un dia s'obre l'editor de sessions, on es pot fer qualsevol canvi i indicar el motiu de la correcció. Cada correcció substitueix el dia sencer, i els canvis de l'edició es guarden a l'historial d'edicions (aquestes dades es poden exportar).

A la pàgina de confirmació mensual es pot obrir un mes perquè cada empleat confirmi el seu registre. Només es poden obrir mesos passats i sense anomalies pendents (tret que s'usi *Forçar obertura*). En confirmar, el mes queda bloquejat; per corregir-lo, un administrador ha de *revocar* la confirmació, i tornar a fer el procés de confirmació per tornar-lo a bloquejar.

Cal remarcar que la detecció d'anomalies existeix per facilitar el reconeixement de possibles problemes, i l'únic impacte funcional que té és (a part de mostrar coses en vermell) que cal marcar "Forçar obertura" per obrir la confirmació d'un mes.


== Vacances anuals de l'empresa

Aquí es configura, per any, el patró comú de vacances que s'aplica a tots els empleats:

- *Festius obligatoris*: dies o intervals de festa de tota l'empresa. El sistema avisa si un interval inclou dies no laborables.
- *Dies electius*: nombre màxim de dies de vacances de lliure elecció que pot demanar cada empleat.

És possible copiar la configuració de l'any anterior. Cal anar en compte amb aquesta acció perquè sobreescriu la configuració de l'any actual!

== Gestió de sol·licituds de vacances d'empleats

Des d'aquí l'administració revisa les sol·licituds de vacances de lliure elecció i les aprova o rebutja. Aprovar una sol·licitud és el que la fa efectiva al calendari i als registres.

== Permisos autoritzats

Els permisos (permís retribuït, baixa mèdica...) funcionen de manera similar a les vacances de lliure el·lecció, excepte que s'han de crear directament des del panell d'administració (els empleats no formen part del procés).

Aclariment: pels càlculs interns de jornades i anomalies, qualsevol cosa que no sigui un dia laborable (dia de setmana no laborable, vacances de l'empresa, vacances de lliure el·lecció i permisos autoritzats) es tracta de la mateixa manera.

== Fitxers compartits

L'administració pot penjar fitxers (per exemple, nòmines) per a cada empleat; només el propi empleat i l'administració els poden veure. Editar-ne el nom o la descripció actualitza la data del fitxer.

== Registre d'activitat

Registre de seguretat de només lectura: recull qui ha fet què i quan (inicis de sessió, canvis d'usuaris, exportacions, fitxers...).

#pagebreak()

= Dades emmagatzemades

L'eina conserva:

- *Dades d'usuari* encriptant camps relacionats amb dades personals (correu electrònic i DNI).
- *Fitxatges* amb l'origen, l'estat i l'historial de versions; les correccions no esborren mai la versió anterior.
- *Vacances i permisos*: sol·licituds, estats i la configuració anual de festius i dies electius.
- *Confirmacions mensuals* i el seu historial (obertura, confirmació i revocació).
- *Fitxers* compartits i el registre de descàrregues.
- *Registre d'activitat*: qui ha fet què i quan.

Els usuaris eliminats no s'esborren de la base de dades: perden l'accés i deixen de ser visibles, però les seves dades es conserven i es poden restaurar.