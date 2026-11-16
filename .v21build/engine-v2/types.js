/**
 * Contrats du moteur musical V2.
 *
 * Règle de dépendance : le planificateur (module B) ne connaît ni l'audio, ni le
 * navigateur, ni le serveur. Il produit un ScorePlan sérialisable ; le rendu
 * (module C) le consomme sans jamais décider de la structure.
 */
export {};
