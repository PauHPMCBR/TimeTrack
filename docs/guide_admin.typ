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
    Guia d'administració de registre jornada
  ]
]

= Introducció

En aquest document, s'expliquen les funcions d'administració, és a dir, tot el que es pot fer
des del panell d'administració.

Es recomana anar comprovant les descripcions amb la pròpia eina, ja que no s'inclouen imatges.
També es recomana llegir la guia d'usuari/empleat disponible per a tothom, perquè la informació d'aquell
document no està repetida aquí.


= Administració

== Configuració global de l'empresa

Aquí es defineixen els valors generals de l'empresa, que els usuaris nous hereten en crear-se. Explicació de camps que poden causar certa confusió:

- *Tolerància*: marge (en minuts) abans de marcar una anomalia, un per a cada mode d'expectativa. La d'*hores esperades* compara el total d'hores treballades amb les esperades; la d'*horari per dies* compara cada fitxatge amb l'horari esperat. Per exemple, per a un empleat que ha de treballar 8h i una tolerància d'1h, "6h 30m" de treball és una anomalia, però "7h" no (i "8h 30m" tampoc, i "9h 01m" sí).

- *Hora de fi de dia*: hora límit a partir de la qual s'avisa per correu els empleats amb fitxatges inconsistents.

- *Consulta prèvia a la representació dels treballadors*: cal marcar-la un cop consultada la representació abans d'implantar el registre de jornada (art. 34.9 ET).

=== Avís de privadesa

A la mateixa pàgina de configuració, al final, hi ha dos camps sobre reglament:

- *Avís de privadesa* (RGPD) que veuen els empleats en registrar-se i des del seu perfil.
 És necessari omplir-lo perquè els empleats el puguin veure i acceptar per utilitzar
 l'eina. Es pot trobar un exemple de contingut a https://registrejornada.fyi/avis_privadesa.txt.

- *Consulta prèvia a la representació de treballadors*: Com el seu nom indica,
 cal marcar explícitament que s'ha pactat l'ús d'aquesta eina amb la representació
 de treballadors.



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
