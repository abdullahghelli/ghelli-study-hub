"""Pearson Edexcel A Level Biology B (9BI0) topics and spec points, as numbered in the specification (Issue 4).
Topics 1-4 are the AS content (8BI0 uses the same numbering), 5-10 the A level only content."""

TOPICS = [
    ("b1", 1, "Biological molecules", "as"),
    ("b2", 2, "Cells, viruses and reproduction of living things", "as"),
    ("b3", 3, "Classification and biodiversity", "as"),
    ("b4", 4, "Exchange and transport", "as"),
    ("b5", 5, "Energy for biological processes", "a2"),
    ("b6", 6, "Microbiology and pathogens", "a2"),
    ("b7", 7, "Modern genetics", "a2"),
    ("b8", 8, "Origins of genetic variation", "a2"),
    ("b9", 9, "Control systems", "a2"),
    ("b10", 10, "Ecosystems", "a2"),
]
GROUPS = [("as", "Topics 1–4 (AS content)"), ("a2", "Topics 5–10 (A level content)")]

P = {
 1: ["Carbohydrates", "Lipids", "Proteins", "DNA and protein synthesis", "Enzymes", "Inorganic ions", "Water"],
 2: ["Eukaryotic and prokaryotic cell structure and function", "Viruses", "Eukaryotic cell cycle and division",
     "Sexual reproduction in mammals", "Sexual reproduction in plants"],
 3: ["Classification", "Natural selection", "Biodiversity"],
 4: ["Surface area to volume ratio", "Cell transport mechanisms", "Gas exchange", "Circulation",
     "Transport of gases in the blood", "Transfer of materials between the circulatory system and cells", "Transport in plants"],
 5: ["Aerobic respiration", "Glycolysis", "Link reaction and Krebs cycle", "Oxidative phosphorylation",
     "Anaerobic respiration", "Photosynthetic pigments", "Photosynthesis"],
 6: ["Microbial techniques", "Bacteria as pathogens", "Action of antibiotics", "Antibiotic resistance",
     "Other pathogenic agents", "Problems of controlling endemic diseases", "Response to infection"],
 7: ["Using gene sequencing", "Factors affecting gene expression", "Stem cells", "Gene technology"],
 8: ["Origins of genetic variation", "Transfer of genetic information", "Gene pools"],
 9: ["Homeostasis", "Chemical control in mammals", "Chemical control in plants",
     "Structure and function of the mammalian nervous system", "Nervous transmission", "Effects of drugs on the nervous system",
     "Detection of light by mammals", "Control of heart rate in mammals", "Osmoregulation and temperature regulation"],
 10: ["The nature of ecosystems", "Energy transfer through ecosystems", "Changes in ecosystems", "Human effects on ecosystems"],
}

NAMES = {}
for _n, _pts in P.items():
    g = "as" if _n <= 4 else "a2"
    for _i, _name in enumerate(_pts, 1):
        NAMES.setdefault(g, {})[f"{_n}.{_i}"] = _name
