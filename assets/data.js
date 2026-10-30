/* =====================================================================
   SITE CONTENT
   Edit this file to add qualifications, boards, subjects, files and past papers.
   Anything without a link shows as "Coming soon" on the site.

   Structure:  level → track (board or option) → subject → { code, topics }
   URLs follow the same shape, e.g. /gcse/cambridge-igcse/physics/2-thermal-physics

   File links can be a path in this repo ("/files/...pdf") or any full URL.
   ===================================================================== */

window.SITE = {
  name: "Ghelli Study Hub",

  subjects: {
    physics:   { name: "Physics",   mark: "Ph", color: "phys" },
    chemistry: { name: "Chemistry", mark: "Ch", color: "chem" },
    biology:   { name: "Biology",   mark: "Bi", color: "bio"  },
    maths:     { name: "Maths",     mark: "Ma", color: "math" },
    "maths-aa":{ name: "Maths: Analysis and Approaches",      mark: "AA", color: "math" },
    "maths-ai":{ name: "Maths: Applications and Interpretation", mark: "AI", color: "math" },
  },

  levels: [
    {
      id: "gcse", name: "GCSE, IGCSE & O Level", short: "GCSE, IGCSE & O Level", blurb: "UK, international and Cambridge O Level",
      groups: [
        { name: "GCSE",  tracks: ["aqa", "edexcel"] },
        { name: "IGCSE", tracks: ["edexcel-igcse", "cambridge-igcse"] },
        { name: "O Level", tracks: ["cambridge-o-level"] },
      ],
      tracks: {
        "aqa": {
          name: "AQA", full: "AQA GCSE", series: ["June", "November"], papers: 3,
          subjects: {
            physics:   { code: "8463", topics: ["Energy","Electricity","Particle Model of Matter","Atomic Structure","Forces","Waves","Magnetism and Electromagnetism","Space Physics"] },
            chemistry: { code: "8462", topics: ["Atomic Structure and the Periodic Table","Bonding, Structure and Properties","Quantitative Chemistry","Chemical Changes","Energy Changes","Rates and Equilibrium","Organic Chemistry","Chemical Analysis","Chemistry of the Atmosphere","Using Resources"] },
            biology:   { code: "8461", topics: ["Cell Biology","Organisation","Infection and Response","Bioenergetics","Homeostasis and Response","Inheritance, Variation and Evolution","Ecology"] },
            maths:     { code: "8300", topics: ["Number","Algebra","Ratio, Proportion and Rates of Change","Geometry and Measures","Probability","Statistics"] },
          },
        },
        "edexcel": {
          name: "Edexcel", full: "Edexcel GCSE", series: ["June", "November"], papers: 3,
          subjects: {
            physics: { code: "1PH0", topics: ["Key Concepts of Physics","Motion and Forces","Conservation of Energy","Waves","Light and the Electromagnetic Spectrum","Radioactivity","Astronomy","Energy: Forces Doing Work","Forces and their Effects","Electricity and Circuits","Static Electricity","Magnetism and the Motor Effect","Electromagnetic Induction","Particle Model","Forces and Matter"] },
            maths:   { code: "1MA1", topics: ["Number","Algebra","Ratio, Proportion and Rates of Change","Geometry and Measures","Probability","Statistics"] },
          },
        },
        "edexcel-igcse": {
          name: "Edexcel IGCSE", full: "Edexcel International GCSE", series: ["January", "June"], papers: 2,
          subjects: {
            physics:   { code: "4PH1", topics: ["Forces and Motion","Electricity","Waves","Energy Resources and Energy Transfers","Solids, Liquids and Gases","Magnetism and Electromagnetism","Radioactivity and Particles","Astrophysics"] },
            chemistry: { code: "4CH1", topics: ["Principles of Chemistry","Inorganic Chemistry","Physical Chemistry","Organic Chemistry"] },
            biology:   { code: "4BI1", topics: ["The Nature and Variety of Living Organisms","Structure and Functions in Living Organisms","Reproduction and Inheritance","Ecology and the Environment","Use of Biological Resources"] },
            maths:     { code: "4MA1", topics: ["Numbers and the Number System","Equations, Formulae and Identities","Sequences, Functions and Graphs","Geometry and Trigonometry","Vectors and Transformation Geometry","Statistics and Probability"] },
          },
        },
        "cambridge-igcse": {
          name: "Cambridge IGCSE", full: "Cambridge IGCSE", series: ["Feb/Mar", "May/Jun", "Oct/Nov"], papers: 4,
          subjects: {
            physics:   { code: "0625", topics: ["Motion, Forces and Energy","Thermal Physics","Waves","Electricity and Magnetism","Nuclear Physics","Space Physics"] },
            chemistry: { code: "0620", topics: ["States of Matter","Atoms, Elements and Compounds","Stoichiometry","Electrochemistry","Chemical Energetics","Chemical Reactions","Acids, Bases and Salts","The Periodic Table","Metals","Chemistry of the Environment","Organic Chemistry","Experimental Techniques"] },
            biology:   { code: "0610", topics: ["Characteristics and Classification of Living Organisms","Organisation of the Organism","Movement into and out of Cells","Biological Molecules","Enzymes","Plant Nutrition","Human Nutrition","Transport in Plants","Transport in Animals","Diseases and Immunity","Gas Exchange in Humans","Respiration","Excretion in Humans","Coordination and Response","Drugs","Reproduction","Inheritance","Variation and Selection","Organisms and their Environment","Human Influences on Ecosystems","Biotechnology and Genetic Modification"] },
            maths:     { code: "0580", topics: ["Number","Algebra and Graphs","Coordinate Geometry","Geometry","Mensuration","Trigonometry","Transformations and Vectors","Probability","Statistics"] },
          },
        },
        "cambridge-o-level": {
          name: "Cambridge O Level", full: "Cambridge O Level", series: ["May/Jun", "Oct/Nov"], papers: 4,
          subjects: {
            physics:   { code: "5054", topics: ["Motion, Forces and Energy","Thermal Physics","Waves","Electricity and Magnetism","Nuclear Physics","Space Physics"] },
            chemistry: { code: "5070", topics: ["States of Matter","Atoms, Elements and Compounds","Stoichiometry","Electrochemistry","Chemical Energetics","Chemical Reactions","Acids, Bases and Salts","The Periodic Table","Metals","Chemistry of the Environment","Organic Chemistry","Experimental Techniques and Chemical Analysis"] },
            biology:   { code: "5090", topics: ["Cells","Classification","Movement into and out of Cells","Biological Molecules","Enzymes","Plant Nutrition","Transport in Plants","Human Nutrition","Transport in Humans","Diseases and Immunity","Gas Exchange","Respiration","Coordination and Response","Homeostasis","Reproduction","Inheritance","Variation and Selection","Organisms and their Environment","Human Influences on Ecosystems","Biotechnology and Genetic Modification"] },
            maths:     { code: "4024", topics: ["Number","Algebra and Graphs","Coordinate Geometry","Geometry","Mensuration","Trigonometry","Transformations and Vectors","Probability","Statistics"] },
          },
        },
      },
    },

    {
      id: "a-level", name: "A Level & International A Level", short: "A Level & IAL", blurb: "AS, A2 and IAL",
      groups: [
        { name: "A Level", tracks: ["aqa", "edexcel"] },
        { name: "International A Level", tracks: ["edexcel-ial", "cambridge"] },
      ],
      tracks: {
        "aqa": {
          name: "AQA", full: "AQA A Level", series: ["June"], papers: 3,
          subjects: {
            physics:   { code: "7408", topics: ["Measurements and their Errors","Particles and Radiation","Waves","Mechanics and Materials","Electricity","Further Mechanics and Thermal Physics","Fields and their Consequences","Nuclear Physics","Astrophysics"] },
            chemistry: { code: "7405", topics: ["Atomic Structure","Amount of Substance","Bonding","Energetics","Kinetics","Chemical Equilibria","Redox","Periodicity","Group 2 and Group 7","Introduction to Organic Chemistry","Alkanes and Halogenoalkanes","Alkenes and Alcohols","Organic Analysis","Thermodynamics","Electrode Potentials","Transition Metals","Aromatic Chemistry","Amines and Polymers","Organic Synthesis and NMR"] },
            biology:   { code: "7402", topics: ["Biological Molecules","Cells","Organisms Exchange Substances","Genetic Information and Variation","Energy Transfers","Responding to Changes","Genetics, Populations, Evolution and Ecosystems","Control of Gene Expression"] },
          },
        },
        "edexcel": {
          name: "Edexcel", full: "Edexcel A Level", series: ["June", "October"], papers: 3,
          subjects: {
            physics:   { code: "9PH0", topics: ["Working as a Physicist","Mechanics","Electric Circuits","Materials","Waves and the Particle Nature of Light","Further Mechanics","Electric and Magnetic Fields","Nuclear and Particle Physics","Thermodynamics","Space","Nuclear Radiation","Gravitational Fields","Oscillations"] },
            chemistry: { code: "9CH0", topics: ["Atomic Structure and the Periodic Table","Bonding and Structure","Redox I","Inorganic Chemistry and the Periodic Table","Formulae, Equations and Amounts","Organic Chemistry I","Modern Analytical Techniques I","Energetics I","Kinetics I","Equilibrium I","Equilibrium II","Acid-Base Equilibria","Energetics II","Redox II","Transition Metals","Kinetics II","Organic Chemistry II","Organic Chemistry III","Modern Analytical Techniques II"] },
            maths:     { code: "9MA0", topics: ["Proof","Algebra and Functions","Coordinate Geometry","Sequences and Series","Trigonometry","Exponentials and Logarithms","Differentiation","Integration","Numerical Methods","Vectors","Statistical Sampling","Data Presentation","Probability","Statistical Distributions","Hypothesis Testing","Kinematics","Forces and Newton's Laws","Moments"],
              paperList: [["1","Paper 1 · Pure"],["2","Paper 2 · Pure"],["31","Paper 31 · Statistics"],["32","Paper 32 · Mechanics"]],
              paperSeries: ["June 2025","June 2024","June 2023","June 2022","November 2021","November 2020","June 2019","June 2018"],
              paperNote: "June 2018 had one combined Paper 3 (Statistics and Mechanics), shown under both columns." },
          },
        },
        "edexcel-ial": {
          name: "Edexcel IAL", full: "Edexcel International A Level", series: ["January", "June", "October"], papers: 6,
          subjects: {
            physics:   { code: "WPH1x", topics: ["Mechanics","Materials","Waves and the Particle Nature of Light","Electric Circuits","Further Mechanics","Electric and Magnetic Fields","Nuclear and Particle Physics","Thermodynamics","Nuclear Decay","Oscillations","Astrophysics and Cosmology"] },
            chemistry: { code: "WCH1x", topics: ["Formulae, Equations and Amounts of Substance","Atomic Structure and the Periodic Table","Bonding and Structure","Introductory Organic Chemistry and Alkanes","Alkenes","Energetics","Intermolecular Forces","Redox Chemistry and Groups 1, 2 and 7","Introduction to Kinetics","Introduction to Equilibrium","Organic Chemistry: Halogenoalkanes, Alcohols and Spectra","Kinetics II","Entropy and Energetics","Chemical Equilibria","Acid-Base Equilibria","Organic Chemistry: Carbonyls, Carboxylic Acids and Chirality","Redox Equilibria","Transition Metals","Organic Nitrogen Compounds","Organic Synthesis"] },
            biology:   { code: "WBI1x", topics: ["Molecules, Diet, Transport and Health","Cells, Development, Biodiversity and Conservation","Energy, Environment, Microbiology and Immunity","Respiration, Internal Environment, Coordination and Gene Technology"] },
            maths:     { code: "YMA01", topics: ["Pure Mathematics 1","Pure Mathematics 2","Pure Mathematics 3","Pure Mathematics 4","Mechanics 1","Mechanics 2","Statistics 1","Statistics 2"] },
          },
        },
        "cambridge": {
          name: "Cambridge", full: "Cambridge International AS & A Level", series: ["Feb/Mar", "May/Jun", "Oct/Nov"], papers: 5,
          subjects: {
            physics: { code: "9702", topics: ["Physical Quantities and Units","Kinematics","Dynamics","Forces, Density and Pressure","Work, Energy and Power","Deformation of Solids","Waves","Superposition","Electricity","D.C. Circuits","Particle Physics","Motion in a Circle","Gravitational Fields","Thermal Physics","Ideal Gases","Oscillations","Electric Fields","Capacitance","Magnetic Fields","Alternating Currents","Quantum Physics","Nuclear Physics","Medical Physics","Astronomy and Cosmology"] },
            maths:   { code: "9709", topics: ["Pure Mathematics 1","Pure Mathematics 3","Mechanics","Probability and Statistics 1","Probability and Statistics 2"] },
          },
        },
      },
    },

    {
      id: "ib", name: "IB DP", short: "IB DP", blurb: "Higher and Standard Level",
      groups: [
        { name: "IB Diploma", tracks: ["hl", "sl"] },
      ],
      tracks: {
        "hl": {
          name: "Higher Level", full: "IB Diploma HL", series: ["May", "November"], papers: 3,
          subjects: {
            physics:    { code: "HL", topics: ["Space, Time and Motion","The Particulate Nature of Matter","Wave Behaviour","Fields","Nuclear and Quantum Physics"] },
            chemistry:  { code: "HL", topics: ["Models of the Particulate Nature of Matter","Models of Bonding and Structure","Classification of Matter","What Drives Chemical Reactions?","How Much, How Fast and How Far?","What Are the Mechanisms of Chemical Change?"] },
            biology:    { code: "HL", topics: ["Unity and Diversity","Form and Function","Interaction and Interdependence","Continuity and Change"] },
            "maths-aa": { code: "HL", topics: ["Number and Algebra","Functions","Geometry and Trigonometry","Statistics and Probability","Calculus"] },
            "maths-ai": { code: "HL", topics: ["Number and Algebra","Functions","Geometry and Trigonometry","Statistics and Probability","Calculus"] },
          },
        },
        "sl": {
          name: "Standard Level", full: "IB Diploma SL", series: ["May", "November"], papers: 2,
          subjects: {
            physics:    { code: "SL", topics: ["Space, Time and Motion","The Particulate Nature of Matter","Wave Behaviour","Fields","Nuclear and Quantum Physics"] },
            chemistry:  { code: "SL", topics: ["Models of the Particulate Nature of Matter","Models of Bonding and Structure","Classification of Matter","What Drives Chemical Reactions?","How Much, How Fast and How Far?","What Are the Mechanisms of Chemical Change?"] },
            biology:    { code: "SL", topics: ["Unity and Diversity","Form and Function","Interaction and Interdependence","Continuity and Change"] },
            "maths-aa": { code: "SL", topics: ["Number and Algebra","Functions","Geometry and Trigonometry","Statistics and Probability","Calculus"] },
            "maths-ai": { code: "SL", topics: ["Number and Algebra","Functions","Geometry and Trigonometry","Statistics and Probability","Calculus"] },
          },
        },
      },
    },
  ],

  /* Resource slots every topic shows. */
  resourceTypes: [
    { id: "notes",  label: "Notes",      slots: [["Revision notes","PDF"],["Key definitions","PDF"],["Equation sheet","PDF"]] },
    { id: "cards",  label: "Flashcards", slots: [["Topic flashcards","SET"]] },
    { id: "qs",     label: "Questions",  slots: [["Topic questions","PDF"],["Mark scheme","PDF"],["Exam-style worksheet","PDF"]] },
    { id: "videos", label: "Videos",     slots: [["Topic walkthrough","VID"]] },
  ],

  /* Topic files. Key: "level/track/subject/topicNumber"
     Example:
       "a-level/edexcel-ial/physics/1": {
         notes: { "Revision notes": "/files/a-level/edexcel-ial/physics/01-mechanics-notes.pdf" },
       },
     A title that isn't a default slot is added as an extra file. */
  files: {
  },

  /* Past papers. Key: "level/track/subject", then "Series Year|paper|QP/MS/ER": link
     Example: "gcse/aqa/physics": { "June 2024|1|QP": "/files/gcse/aqa/physics/papers/p1-qp-jun24.pdf" } */
  papers: {
    "a-level/edexcel/maths": {
      "June 2025|1|QP": "/files/a-level/edexcel/maths/papers/9ma0-p1-qp-jun2025.pdf",
      "June 2025|32|QP": "/files/a-level/edexcel/maths/papers/9ma0-p32-qp-jun2025.pdf", "June 2025|32|MS": "/files/a-level/edexcel/maths/papers/9ma0-p32-ms-jun2025.pdf",
      "June 2024|31|QP": "/files/a-level/edexcel/maths/papers/9ma0-p31-qp-jun2024.pdf", "June 2024|31|MS": "/files/a-level/edexcel/maths/papers/9ma0-p31-ms-jun2024.pdf",
      "June 2024|32|QP": "/files/a-level/edexcel/maths/papers/9ma0-p32-qp-jun2024.pdf", "June 2024|32|MS": "/files/a-level/edexcel/maths/papers/9ma0-p32-ms-jun2024.pdf",
      "June 2023|31|QP": "/files/a-level/edexcel/maths/papers/9ma0-p31-qp-jun2023.pdf", "June 2023|31|MS": "/files/a-level/edexcel/maths/papers/9ma0-p31-ms-jun2023.pdf",
      "June 2023|32|QP": "/files/a-level/edexcel/maths/papers/9ma0-p32-qp-jun2023.pdf", "June 2023|32|MS": "/files/a-level/edexcel/maths/papers/9ma0-p32-ms-jun2023.pdf",
      "June 2022|31|QP": "/files/a-level/edexcel/maths/papers/9ma0-p31-qp-jun2022.pdf", "June 2022|31|MS": "/files/a-level/edexcel/maths/papers/9ma0-p31-ms-jun2022.pdf",
      "June 2022|32|QP": "/files/a-level/edexcel/maths/papers/9ma0-p32-qp-jun2022.pdf", "June 2022|32|MS": "/files/a-level/edexcel/maths/papers/9ma0-p32-ms-jun2022.pdf",
      "November 2021|31|QP": "/files/a-level/edexcel/maths/papers/9ma0-p31-qp-nov2021.pdf", "November 2021|31|MS": "/files/a-level/edexcel/maths/papers/9ma0-p31-ms-nov2021.pdf",
      "November 2021|32|QP": "/files/a-level/edexcel/maths/papers/9ma0-p32-qp-nov2021.pdf",
      "November 2020|31|QP": "/files/a-level/edexcel/maths/papers/9ma0-p31-qp-nov2020.pdf", "November 2020|31|MS": "/files/a-level/edexcel/maths/papers/9ma0-p31-ms-nov2020.pdf",
      "November 2020|32|QP": "/files/a-level/edexcel/maths/papers/9ma0-p32-qp-nov2020.pdf", "November 2020|32|MS": "/files/a-level/edexcel/maths/papers/9ma0-p32-ms-nov2020.pdf",
      "June 2019|31|QP": "/files/a-level/edexcel/maths/papers/9ma0-p31-qp-jun2019.pdf", "June 2019|31|MS": "/files/a-level/edexcel/maths/papers/9ma0-p31-ms-jun2019.pdf",
      "June 2019|32|QP": "/files/a-level/edexcel/maths/papers/9ma0-p32-qp-jun2019.pdf", "June 2019|32|MS": "/files/a-level/edexcel/maths/papers/9ma0-p32-ms-jun2019.pdf", "June 2018|2|MS": "/files/a-level/edexcel/maths/papers/9ma0-p2-ms-jun2018.pdf",
      "June 2018|31|QP": "/files/a-level/edexcel/maths/papers/9ma0-p3-qp-jun2018.pdf", "June 2018|31|MS": "/files/a-level/edexcel/maths/papers/9ma0-p3-ms-jun2018.pdf",
      "June 2018|32|QP": "/files/a-level/edexcel/maths/papers/9ma0-p3-qp-jun2018.pdf", "June 2018|32|MS": "/files/a-level/edexcel/maths/papers/9ma0-p3-ms-jun2018.pdf",
    },
  },
  years: [2025, 2024, 2023, 2022, 2021, 2020, 2019],

  /* Formula sheets / data booklets. Key: "level/track/subject" → link */
  formulaSheets: {
  },
};
