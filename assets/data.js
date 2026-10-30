/* =====================================================================
   SITE CONTENT
   Edit this file to add subjects, topics, files and past papers.
   Anything without a link shows as "Coming soon" on the site.

   File links can be:
     - a path to a file in this repo, e.g. "/files/a-level/physics/edexcel/mechanics-notes.pdf"
     - any full URL, e.g. a Google Drive link
   ===================================================================== */

window.SITE = {
  name: "Ghelli Study Hub",

  levels: [
    { id: "a-level", name: "A Level", blurb: "AS and A2 for Edexcel, AQA and Cambridge" },
    { id: "igcse",   name: "IGCSE",   blurb: "Edexcel International and Cambridge" },
    { id: "gcse",    name: "GCSE",    blurb: "AQA and Edexcel, grades 9–1" },
  ],

  subjects: {
    physics:   { name: "Physics",   mark: "Ph", color: "phys" },
    chemistry: { name: "Chemistry", mark: "Ch", color: "chem" },
    biology:   { name: "Biology",   mark: "Bi", color: "bio"  },
    maths:     { name: "Maths",     mark: "Ma", color: "math" },
  },

  boards: { edexcel: "Edexcel", aqa: "AQA", cambridge: "Cambridge" },

  /* level → subject → board → { code, topics } */
  courses: {
    "a-level": {
      physics: {
        edexcel:   { code: "9PH0", topics: ["Working as a Physicist","Mechanics","Electric Circuits","Materials","Waves and the Particle Nature of Light","Further Mechanics","Electric and Magnetic Fields","Nuclear and Particle Physics","Thermodynamics","Space","Nuclear Radiation","Gravitational Fields","Oscillations"] },
        aqa:       { code: "7408", topics: ["Measurements and their Errors","Particles and Radiation","Waves","Mechanics and Materials","Electricity","Further Mechanics and Thermal Physics","Fields and their Consequences","Nuclear Physics","Astrophysics"] },
        cambridge: { code: "9702", topics: ["Physical Quantities and Units","Kinematics","Dynamics","Forces, Density and Pressure","Work, Energy and Power","Deformation of Solids","Waves","Superposition","Electricity","D.C. Circuits","Particle Physics","Motion in a Circle","Gravitational Fields","Thermal Physics","Ideal Gases","Oscillations","Electric Fields","Capacitance","Magnetic Fields","Alternating Currents","Quantum Physics","Nuclear Physics","Medical Physics","Astronomy and Cosmology"] },
      },
      chemistry: {
        aqa:     { code: "7405", topics: ["Atomic Structure","Amount of Substance","Bonding","Energetics","Kinetics","Chemical Equilibria","Redox","Periodicity","Group 2 and Group 7","Introduction to Organic Chemistry","Alkanes and Halogenoalkanes","Alkenes and Alcohols","Organic Analysis","Thermodynamics","Electrode Potentials","Transition Metals","Aromatic Chemistry","Amines and Polymers","Organic Synthesis and NMR"] },
        edexcel: { code: "9CH0", topics: ["Atomic Structure and the Periodic Table","Bonding and Structure","Redox I","Inorganic Chemistry and the Periodic Table","Formulae, Equations and Amounts","Organic Chemistry I","Modern Analytical Techniques I","Energetics I","Kinetics I","Equilibrium I","Equilibrium II","Acid-Base Equilibria","Energetics II","Redox II","Transition Metals","Kinetics II","Organic Chemistry II","Organic Chemistry III","Modern Analytical Techniques II"] },
      },
      biology: {
        aqa: { code: "7402", topics: ["Biological Molecules","Cells","Organisms Exchange Substances","Genetic Information and Variation","Energy Transfers","Responding to Changes","Genetics, Populations, Evolution and Ecosystems","Control of Gene Expression"] },
      },
      maths: {
        edexcel: { code: "9MA0", topics: ["Proof","Algebra and Functions","Coordinate Geometry","Sequences and Series","Trigonometry","Exponentials and Logarithms","Differentiation","Integration","Numerical Methods","Vectors","Statistical Sampling","Data Presentation","Probability","Statistical Distributions","Hypothesis Testing","Kinematics","Forces and Newton's Laws","Moments"] },
      },
    },
    igcse: {
      physics: {
        edexcel:   { code: "4PH1", topics: ["Forces and Motion","Electricity","Waves","Energy Resources and Energy Transfers","Solids, Liquids and Gases","Magnetism and Electromagnetism","Radioactivity and Particles","Astrophysics"] },
        cambridge: { code: "0625", topics: ["Motion, Forces and Energy","Thermal Physics","Waves","Electricity and Magnetism","Nuclear Physics","Space Physics"] },
      },
      chemistry: {
        cambridge: { code: "0620", topics: ["States of Matter","Atoms, Elements and Compounds","Stoichiometry","Electrochemistry","Chemical Energetics","Chemical Reactions","Acids, Bases and Salts","The Periodic Table","Metals","Chemistry of the Environment","Organic Chemistry","Experimental Techniques"] },
        edexcel:   { code: "4CH1", topics: ["Principles of Chemistry","Inorganic Chemistry","Physical Chemistry","Organic Chemistry"] },
      },
      biology: {
        edexcel: { code: "4BI1", topics: ["The Nature and Variety of Living Organisms","Structure and Functions in Living Organisms","Reproduction and Inheritance","Ecology and the Environment","Use of Biological Resources"] },
      },
      maths: {
        edexcel:   { code: "4MA1", topics: ["Numbers and the Number System","Equations, Formulae and Identities","Sequences, Functions and Graphs","Geometry and Trigonometry","Vectors and Transformation Geometry","Statistics and Probability"] },
        cambridge: { code: "0580", topics: ["Number","Algebra and Graphs","Coordinate Geometry","Geometry","Mensuration","Trigonometry","Transformations and Vectors","Probability","Statistics"] },
      },
    },
    gcse: {
      physics:   { aqa:     { code: "8463", topics: ["Energy","Electricity","Particle Model of Matter","Atomic Structure","Forces","Waves","Magnetism and Electromagnetism","Space Physics"] } },
      chemistry: { aqa:     { code: "8462", topics: ["Atomic Structure and the Periodic Table","Bonding, Structure and Properties","Quantitative Chemistry","Chemical Changes","Energy Changes","Rates and Equilibrium","Organic Chemistry","Chemical Analysis","Chemistry of the Atmosphere","Using Resources"] } },
      biology:   { aqa:     { code: "8461", topics: ["Cell Biology","Organisation","Infection and Response","Bioenergetics","Homeostasis and Response","Inheritance, Variation and Evolution","Ecology"] } },
      maths:     { edexcel: { code: "1MA1", topics: ["Number","Algebra","Ratio, Proportion and Rates of Change","Geometry and Measures","Probability","Statistics"] } },
    },
  },

  /* Resource slots every topic shows. */
  resourceTypes: [
    { id: "notes",  label: "Notes",      slots: [["Revision notes","PDF"],["Key definitions","PDF"],["Equation sheet","PDF"]] },
    { id: "cards",  label: "Flashcards", slots: [["Topic flashcards","SET"]] },
    { id: "qs",     label: "Questions",  slots: [["Topic questions","PDF"],["Mark scheme","PDF"],["Exam-style worksheet","PDF"]] },
    { id: "videos", label: "Videos",     slots: [["Topic walkthrough","VID"]] },
  ],

  /* Topic files.
     Key: "level/subject/board/topicNumber"
     Example:
       "a-level/physics/edexcel/2": {
         notes: { "Revision notes": "/files/a-level/physics/edexcel/02-mechanics-notes.pdf" },
         qs:    { "Topic questions": "https://drive.google.com/…" }
       },
     A title that isn't one of the default slots is added as an extra file. */
  files: {
  },

  /* Past papers.
     Key: "level/subject/board", then "Series Year|paper|QP/MS/ER": link
     Example:
       "a-level/physics/edexcel": { "June 2024|1|QP": "/files/…/9ph0-01-qp-jun24.pdf" } */
  papers: {
  },

  series: {
    "a-level/edexcel": ["June","October"], "a-level/aqa": ["June"], "a-level/cambridge": ["Feb/Mar","May/Jun","Oct/Nov"],
    "igcse/edexcel": ["January","June"],   "igcse/cambridge": ["Feb/Mar","May/Jun","Oct/Nov"],
    "gcse/aqa": ["June","November"],       "gcse/edexcel": ["June","November"],
  },
  years: [2025, 2024, 2023, 2022, 2021, 2020, 2019],
  paperCount: { "a-level": 3, igcse: 2, gcse: 3 },

  /* Formula sheets / data booklets. Key: "level/subject/board" → link */
  formulaSheets: {
  },
};
