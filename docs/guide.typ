= Introducció

Durant tot el document, hi ha una separació de tipus d'usuaris de l'eina segons el seu rol:

- *Administrador* (o cap o responsable): normalment cap de l'empresa o similar. Té control de les dades de l'eina i no ha de fitxar registres.
- *Empleat* (o usuari "normal"): està obligat a fitxar per llei, no té permisos elevats a l'aplicació.

= Part comuna

== Activar un compte

Un administrador pot crear un nou compte per un nou usuari (administrador o empleat). Durant la creació, cal especificar el correu, nom i DNI (instruccions per a administrador més endavant). Després d'especificar aquests camps, s'envia un correu a l'adreça indicada automàticament anunciant que han sigut convidats a l'eina:

#image("pic/mail_reg.png")

Alternativament, també es pot compartir l'enllaç que es mostra al panell d'administració (és el mateix).

L'enllaç porta a la pàgina de registre, on s'estableix la contrassenya del compte, que fa que quedi activat. A partir d'aquest moment, es pot accedir a l'eina iniciant sessió amb el correu + contrassenya.

= Empleats

== Fitxar entrada i sortida

La utilitat principal de l'eina és el fitxatge d'entrada i sortida de la feina. A la primera pàgina, es pot indicar entrada/sortida, i incloure un motiu/observació opcional. Els caps d'empresa *no* estan obligats per llei a fitxar.

#image("pic/fitxar.png")

== Detecció d'anomalies i fitxatge automàtic

En cas d'haver oblidat de fitxar correctament (fitxar entrada però no sortida, o no complir amb les hores de feina esperades o passar-se, dintre d'un marge), s'envia (si es té configurat a la configuració de l'empresa, sí per defecte) un correu avisant de l'anomalia.

#image("pic/mail_auto.png")

Aquest correu inclou un enllaç per aplicar ràpidament el fitxatge automàtic. El fitxatge automàtic *substitueix* els temps d'entrada i sortida amb uns intervals de temps configurables pel propi empleat (a la primera pàgina), deixant marcat al registre que els temps guardats s'han generat d'aquesta manera i no marcant el botó d'entrada i sortida manualment. La intenció d'aquesta funció és poder arreglar ràpidament despistades pròpies.

#image("pic/horari_auto.png")

L'aplicació de fitxatge automàtic és legal: la llei demana que es guardin uns registres de hores de treball mensuals confirmades per l'empleat, per tant tota la informació que l'empleat consideri com a vàlida és vàlida. Cal recordar que és possible modificar les hores que aplica el fitxatge automàtic abans d'aplicar-lo al dia corresponent.

== Historial i validació de dades mensuals

A la pestanya d'historial es poden veure els fitxatges d'entrada i sortida diaris, amb uns quants filtres disponibles. També s'indica amb una icona si les dades han sigut generades manualment (clicar entrada/sortida), amb el fitxatge automàtic, o si han sigut editades per un administrador.

Observeu la llegenda de colors i icones que es mostra dalt de la taula per entendre tota la informació inclosa.

#image("pic/historial.png")

Al final del mes, un cop un administrador hagi revisat els fitxatges, els empleats reben un correu demanant que confirmin els registres guardats d'un mes en concret:

#image("pic/mail_confirm.png")

Es recomana revisar les dades utilitzant la pàgina d'historial. Si s'està desacord amb alguna dada, cal comentar-ho amb responsables a través de medis de comunicació externs a l'eina.

// TODO confirm image un cop havent fet retocs del procés

És obligatori per llei que els empleats confirmin els registres mensuals. Un cop confirmats, no es poden modificar (a no ser que un administrador invalidi aquesta confirmació, cosa que requereix repetir el procés per tornar a bloquejar les dades). Els dies amb dades bloquejades apareixen més atenuats i amb una icona de candau a l'historial.

== Sol·licitud de vacances

== Calendari i grups


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