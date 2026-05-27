/** Contenu issu de la feuille Excel « 0_LisezMoi », adapté à l'application CRM. */

export const QUALITY_GUIDE = {
  title: "Outil Qualité — Télésecrétariat Médical / CRC",
  intro:
    "Cet espace permet d'évaluer des écoutes (appels / messages) avec un référentiel qualité premium, un scoring automatique et des plafonnements — comme le classeur Excel 2C Quality.",

  parcours: [
    {
      step: 1,
      excel: "1_Referentiel",
      app: "Référentiel (ci-dessous + grille de notation)",
      description:
        "Consultez les critères, les attendus, les critères bloquants et la grille de notation (-1 à 3). Le référentiel est intégré dans chaque nouvelle écoute.",
    },
    {
      step: 2,
      excel: "2_Base_Ecoutes",
      app: "Nouvelle écoute / Écoutes",
      description:
        "Saisissez vos écoutes : conseiller, campagne, canal et note par critère. La mention, le statut et les axes d'amélioration se calculent automatiquement.",
    },
    {
      step: 3,
      excel: "3_Grille_Ecoute",
      app: "Voir une écoute (liste → Voir)",
      description:
        "Affichez une grille propre et imprimable pour une écoute enregistrée : scores, note finale, mention et statut.",
    },
    {
      step: 4,
      excel: "4_Dashboard",
      app: "Dashboard",
      description:
        "Suivez les KPI, tendances et points faibles par conseiller / campagne / période (filtres en haut de page).",
    },
    {
      step: 5,
      excel: "5_Plan_Action",
      app: "Plan d'action (dans le formulaire d'écoute)",
      description:
        "Renseignez le plan d'action managérial et les axes d'amélioration auto-générés à partir des scores.",
    },
    {
      step: 6,
      excel: "6_Débrief_Conseiller",
      app: "Débrief conseiller (dans le formulaire d'écoute)",
      description:
        "Complétez points forts, plan d'action, date de débrief et conclusion managériale. Les suggestions et axes sont pré-remplis depuis l'évaluation.",
    },
  ],

  plafonds: [
    "Si au moins un critère est noté **-1** → note finale plafonnée à **8/20**.",
    "Si au moins un critère **BLOQUANT** est noté **< 2** → note finale plafonnée à **12/20**.",
  ],

  bonnesPratiques: [
    "Utilisez **-1** uniquement en cas de non-conformité majeure (ex. : violation confidentialité/RGPD, erreur médicale critique, propos inadaptés).",
    "Les critères **bloquants** doivent être au minimum à **2** pour éviter le plafonnement.",
  ],

  mentions: [
    { label: "Excellent", seuil: "≥ 18/20" },
    { label: "Très satisfaisant", seuil: "≥ 16/20" },
    { label: "Satisfaisant", seuil: "≥ 14/20" },
    { label: "À améliorer", seuil: "≥ 12/20" },
    { label: "Médiocre", seuil: "< 12/20" },
  ],

  statuts: [
    { label: "Conforme", regle: "Note finale ≥ 14/20 et aucun plafonnement critique." },
    { label: "Coaching prioritaire", regle: "Note finale < 14/20 sans action immédiate." },
    { label: "Action immédiate", regle: "Critère noté -1 ou critère bloquant < 2." },
  ],

  personnalisation: [
    "Les **conseillers** et **campagnes** proviennent de l'application CRM (Utilisateurs / Campagnes).",
    "L'**évaluateur** est automatiquement le coach qualité connecté lors de la saisie.",
    "Les seuils de mention et les règles de plafonnement sont ceux du référentiel 2C Quality (voir ci-dessus).",
  ],
};
