#set par(justify: true)
#set text(font: "New Computer Modern", size: 11pt)
#set heading(numbering: "1.")
#set page(numbering: "1 / 1")
#let img = (source) => align(center)[
  #box(image(source, width: 95%), stroke: color.black)
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

L'enllaç porta a la pàgina de registre, on s'estableix la contrassenya del compte, que fa que quedi activat. A partir d'aquest moment, es pot accedir a l'eina iniciant sessió amb el correu + contrassenya.

== Reinici de contrassenya

Existeix el mètode clàssic d'enviar un correu electrònic per restablir la contrassenya. Aquesta acció també desbloqueja un compte que ha quedat bloquejat per haver intentat iniciar sessió amb la contrassenya incorrecta massa vegades seguides.

= Empleats

== Fitxar entrada i sortida

La utilitat principal de l'eina és el fitxatge d'entrada i sortida de la feina. A la primera pàgina, es pot indicar entrada/sortida, i incloure un motiu/observació opcional.

L'obligació legal de fitxar afecta gairebé totes les persones treballadores (art. 34.9 ET): només l'alta direcció (fora de l'àmbit de l'art. 1.3.c ET) n'està exempta.

#img("pic/fitxar.png")

== Detecció d'anomalies i fitxatge automàtic

En cas d'haver oblidat de fitxar correctament (fitxar entrada però no sortida, o no complir amb les hores de feina esperades o passar-se, dintre d'un marge), s'envia (si es té configurat a la configuració de l'empresa, sí per defecte) un correu avisant de l'anomalia.

#img("pic/mail_auto.png")

Aquest correu inclou un enllaç per aplicar ràpidament el fitxatge automàtic. El fitxatge automàtic *substitueix* els temps d'entrada i sortida amb uns intervals de temps configurables pel propi empleat (a la primera pàgina), deixant marcat al registre que els temps guardats s'han generat d'aquesta manera i no marcant el botó d'entrada i sortida manualment. La intenció d'aquesta funció és poder arreglar ràpidament despistades pròpies.

#img("pic/horari_auto.png")

L'aplicació de fitxatge automàtic és compatible amb la llei: els sistemes d'auto-declaració són vàlids sempre que el registre continuï sent objectiu, fiable i accessible (STS 41/2023), i aquesta eina garanteix els tres requisits: les marques són generades i datades pel servidor, les modificacions queden versionades sense esborrar res, i la persona treballadora pot consultar el seu historial complet. Cal recordar que és possible modificar les hores que aplica el fitxatge automàtic abans d'aplicar-lo al dia corresponent.

== Historial i validació de dades mensuals

A la pestanya d'historial es poden veure els fitxatges d'entrada i sortida diaris, amb uns quants filtres disponibles. També s'indica amb una icona si les dades han sigut generades manualment (clicar entrada/sortida), amb el fitxatge automàtic, o si han sigut editades per un administrador.

Observeu la llegenda de colors i icones que es mostra dalt de la taula per entendre tota la informació inclosa.

#img("pic/historial.png")

Al final del mes, un cop un administrador hagi revisat els fitxatges, els empleats reben un correu demanant que confirmin els registres guardats d'un mes en concret:

#img("pic/mail_confirm.png")

Es recomana revisar les dades utilitzant la pàgina d'historial. Si s'està desacord amb alguna dada, cal comentar-ho amb responsables a través de medis de comunicació externs a l'eina.

Es pot confirmar des de la pàgina inicial (de fitxatge) quan hi ha un mes pendent per confirmar, i també es pot veure l'estat de confirmacions mensuals al final de la pàgina d'historial:

#img("pic/history_confirm.png")

És obligatori per llei que les dades de fitxatge quedin confirmades pels empleats i per l'equip directiu. És per això que es demana fer una confirmació mútua de les dades al final de cada mes.

Un cop confirmats, no es poden modificar (a no ser que un administrador invalidi aquesta confirmació, cosa que requereix repetir el procés per tornar a bloquejar les dades). Els dies amb dades bloquejades apareixen més atenuats i amb una icona de candau a l'historial.

== Sol·licitud de vacances

Els administradors són responsables d'assignar els dies de vacances comuns de l'empresa (festius, vacances obligatòries) de cada any. A la pàgina de vacances es mostren tals dies com a "Festes de l'empresa".

A la pàgina de vacances és on es creen les sol·licituds de vacances de lliure elecció. Primer cal assegurar-se que l'any sel·leccionat és el correcte. Es mostren els dies de lliure elecció disponibles, gastats i totals de l'any, i hi ha un formulari per demanar un interval nou de vacances. Un cop especificat l'interval, apareix un indicador del nombre de vacances de lliure el·lecció que "costa" la sol·licitud, tenint en compte festius i dies no laborables.

#img("pic/solicitud_vacances.png")

L'estat de sol·licituds es pot veure al final de la pàgina, on també es poden cancel·lar les sol·licituds pendents. La negociació de vacances de lliure el·lecció s'ha de fer a través d'un medi extern a l'eina.

== Calendari i grups

A la pàgina de calendari es poden veure les vacances de tot tipus, a més dels registres diaris. Aquesta pàgina és útil si a l'empresa es creen grups. Com a empleat, pots veure les vacances d'altres empleats amb què comparteixis un grup (es poden visualitzar els grups als quals un usuari pertany a partir de la seva pàgina de perfil). La llegenda explica la codificació de colors.

#img("pic/calendar.png")

Es pot clicar un dia del calendari per veure la informació amb més detall. Es mostren els fitxatges d'aquell dia, a més de tota la informació relacionada amb vacances.

== Fitxers

Es pot accedir a la pàgina de fitxers de l'empleat a través de la pàgina de perfil. Consisteix en una llista de fitxers penjats per un administrador, que només el propi empleat i els administradors poden veure. La data del fitxer correspon a l'última edició (els administradors poden editar el nom i descripció d'un fitxer).

Un possible ús d'aquesta funció és compartir les nòmines mensuals.

= Administrador

== Configuració global de l'empresa

Explicació de camps que poden causar certa confusió:

- *Tolerància*: Es detecta com a anomalia (fitxatge incorrecte) quan la suma d'hores treballades per un empleat difereix de les hores de treball esperades per un temps més gran al valor de "Tolerància". Per exemple, per un empleat que ha de treballar 8h, si la tolerància és 1h, "6h 30m" de treball és una anomalia, però "7h" no (i "8h 30m" tampoc, i "9h 01m" sí).

- *Hora de fi de dia*: Moment en què s'envien correus avisant d'anomalies als empleats. 

== Gestió d'usuaris i grups

A la pàgina d'empleats també es mostren els administradors (és a dir, es mostren tots els usuaris).

En aquesta pàgina d'usuaris es poden crear nous usuaris i editar els existents. // TODO delete
A més, també permet exportar els temps de fitxatge dels usuaris sel·leccionats i interval de temps sel·leccionat. // TODO invalidar contrassenya desbloqueja usuari?

Aneu en compte en elevar el rol d'un usuari a administrador: aquest canvi no el pot desfer un administrador, per tant cal contactar amb suport tècnic per desfer-lo si es tracta d'una errada.

== Resoldre anomalies de fitxatges i petició de confirmació mensual

== Vacances anuals de l'empresa

== Gestió de sol·licituds de vacances d'empleats

= Dades emmagatzemades