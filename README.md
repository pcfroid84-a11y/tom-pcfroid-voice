# Tom PC Froid Voice

Passerelle vocale de Tom, assistant téléphonique de PC Froid, déployée sur Railway.

## Production

La production reste basée sur `main`. Le comportement téléphonique V2.10 FLOW LOCK doit rester stable pendant la préparation du socle V1.

Sauvegarde créée avant les travaux V1 :

`backup-2026-08-30-avant-base-v1`

Branche de préparation :

`work-base-v1-2026-08-30`

Cette branche n'est pas destinée à être basculée en production sans appel de test.

## Objectif V1

Faire de Tom un standard fiable : comprendre, qualifier, transmettre, mémoriser et confirmer au client, avec transfert humain et connaissances PC Froid contrôlées.

Voir :

- `docs/BASE_V1.md`
- `docs/END_CALL_CONTRACT.md`
- `docs/MAIL_SMS_V1.md`
- `docs/MEMORY_N8N_PLAN.md`
- `docs/HUMAN_TRANSFER_PLAN.md`
- `docs/TEST_SCENARIOS_V1.md`

## Connaissances

- `knowledge/site-v1.json` : informations publiques PC Froid préparées depuis le site ;
- `knowledge/tariffs-v1.json` : grille tarifaire publiée, préparée mais à valider avant activation vocale.

Par défaut, le loader V1 autorise les connaissances du site sur la branche de travail et garde les tarifs désactivés tant que `TOM_ENABLE_TARIFFS` n'est pas explicitement activé.

## Tests

```bash
npm test
```

Les tests sont réalisés avec `node:test` et ne nécessitent aucune dépendance supplémentaire.
