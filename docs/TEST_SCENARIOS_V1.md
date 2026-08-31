# Scénarios de test avant mise en ligne

Chaque scénario doit être testé sur un vrai appel. Pour chacun, vérifier : conversation, mémoire, mail, SMS, catégorie, urgence et absence d'invention.

## 1. Prospect — entretien climatisation

Client : « Je voudrais prendre rendez-vous pour l'entretien de ma clim. »

Attendu :
- Tom ne demande pas de date ni de disponibilité à ce stade ;
- il demande d'abord si la personne est déjà cliente ;
- statut prospect ;
- identité correctement captée ;
- ville puis adresse ;
- catégorie `PROSPECT`, jamais `URGENCE` ;
- motif `Entretien climatisation` ;
- en fin d'appel, Tom rassure : la demande est enregistrée et l'équipe rappellera pour convenir d'un créneau selon les disponibilités du client ;
- mail lisible ;
- SMS avec motif + ville ;
- mémoire complète.

## 2. Client existant — entretien

Attendu :
- ne pas redemander inutilement toutes les informations connues ;
- vérifier naturellement le lieu d'intervention en fin de parcours ;
- catégorie `CLIENT` ;
- conclusion rassurante adaptée à l'entretien.

## 3. Dépannage climatisation particulier

Exemple : « La clim tourne mais ne fait plus de froid depuis ce matin. »

Attendu :
- recueillir les symptômes utiles sans faire de diagnostic affirmatif ;
- pas d'urgence automatique sauf règle métier explicite ;
- si tarif demandé, n'annoncer que la grille validée.

## 4. Urgence froid commercial professionnel

Exemple : restaurant, chambre froide positive qui ne refroidit plus avec marchandise à risque.

Attendu :
- détecter professionnel + froid commercial ;
- identifier le caractère potentiellement prioritaire ;
- appliquer uniquement les règles d'urgence PC Froid validées ;
- transfert humain si la règle le prévoit et si le transfert est réellement activé ;
- mail clairement marqué urgent uniquement si confirmé.

## 5. Personne difficile à comprendre

Accent, personne âgée, mauvaise ligne ou formulation confuse.

Attendu :
- première incompréhension : excuse + reformulation naturelle adaptée à l'information demandée ;
- ne jamais répéter mécaniquement exactement la même question ;
- ne jamais dire « merci pour cette confirmation » si la transcription est douteuse ;
- au maximum une seconde tentative ;
- si le motif reste incertain : reprise humaine lorsque le transfert réel est activé ; sinon conservation de la demande et rappel par l'équipe ;
- aucune invention de motif.

## 6. Question tarifaire

Tester chaque type de prix : fixe, « à partir de », HT, devis sur demande, promotion.

Attendu :
- reprendre exactement le tarif validé ;
- conserver « à partir de » ;
- conserver HT/TTC ;
- dire devis sur demande quand nécessaire ;
- ne pas extrapoler.

## 7. Question sur les prestations

Exemples : gainable, chauffe-eau thermodynamique, chambre froide, PAC air/eau.

Attendu : répondre uniquement avec la base PC Froid active issue du site ou d'une règle interne validée.

## 8. Demande administrative

Exemples : facture, devis en attente, règlement, attestation.

Attendu : identifier `ADMINISTRATIF`, prendre le message utile et transmettre sans qualification technique inutile.

## 9. Partenaire / fournisseur / syndic

Attendu : parcours court, identité/société/téléphone/message, catégorie `PARTENAIRE`.

## 10. Démarchage commercial

Attendu : ne pas lancer le parcours client complet. Appliquer la règle de filtrage validée.

## 11. Hors zone

Attendu : ne pas inventer une intervention possible. Utiliser le référentiel de zone et transmettre si la commune doit être vérifiée.

## 12. Appel interrompu

Le client raccroche après avoir donné seulement une partie des informations.

Attendu :
- créer une mémoire d'appel `incomplet` ;
- conserver téléphone, transcription et informations déjà connues ;
- ne pas envoyer de résumé mensonger indiquant que tout est enregistré si l'appel n'a pas atteint la fin normale ;
- permettre un rappel manuel.

## 13. Réponse SMS le lendemain

Après un appel complet, répondre au SMS 24 h plus tard.

Attendu :
- retrouver le dernier appel compatible du même numéro ;
- enregistrer le SMS entrant ;
- mail `[RÉPONSE SMS]` avec identité et motif ;
- si plusieurs appels rendent le rattachement ambigu, marquer `À CONFIRMER` plutôt que choisir arbitrairement.

## 14. Identité mal comprise

Donner volontairement une ville au moment où Tom attend un nom, puis donner un vrai prénom/nom plus tard.

Attendu :
- ne jamais considérer une ville identique à la ville d'intervention comme identité fiable ;
- la première réponse invalide déclenche une reformulation naturelle du type « Excusez-moi, je n’ai pas pu interpréter correctement ce que vous avez dit… » ;
- mail et mémoire doivent afficher `Identité à confirmer` si elle n'a pas été corrigée.

## 15. Fin d'appel

Tester « au revoir », silence, raccrochage client et fin normale.

Attendu : un seul événement de fin d'appel, un seul mail et un seul SMS. Aucun doublon entre `twilio-stop` et `socket-close`.

## 16. « Allô ? » après l'accueil

Dire seulement « Allô ? » ou provoquer une première transcription inexploitable.

Attendu :
- Tom ne reste jamais silencieux ;
- sur « Allô ? » : réponse courte du type « Oui, je vous écoute. Que puis-je faire pour vous ? » ;
- sur une transcription inexploitable : excuse courte + demande de reformulation ;
- ne pas lancer prématurément le parcours client si le motif n'est pas encore compris.

## 17. Détails d'un entretien de climatisation

Client : « Qu'est-ce que vous faites exactement pendant l'entretien ? »

Attendu :
- explication claire : protection par bâche, démontage des habillages nécessaires, nettoyage filtres/échangeur/turbine, désinfection, condensats lorsque pertinent, groupe extérieur et contrôle de fonctionnement ;
- mention possible du contrôle des températures selon la machine et l'intervention ;
- durée indicative publique : environ 30 à 45 minutes par climatiseur ;
- si le client veut voir la méthode : orientation vers la page Climatisation de pcfroid.fr où une photo est disponible ;
- ne jamais inventer une vidéo.

## 18. Entretien ou panne ?

Client : « Ma clim souffle moins bien / elle fait moins de froid et ça fait longtemps que je n'ai pas fait l'entretien. »

Attendu :
- expliquer qu'un entretien complet est une bonne première étape si l'entretien est ancien ;
- expliquer qu'il permet de nettoyer et de contrôler la machine dans de bonnes conditions ;
- ne jamais garantir que l'entretien réparera la panne ;
- si absence totale de froid, défaut, fuite, bruit anormal ou symptôme important : préciser qu'un diagnostic technique peut être nécessaire ;
- garder un ton rassurant et professionnel.
