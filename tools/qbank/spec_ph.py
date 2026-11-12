"""Pearson Edexcel A Level Physics (9PH0) topics, with each topic's content grouped into short spec points ("N.n").
Topics 1-5 are the AS content, 6-13 the A level only content."""

TOPICS = [
    ("p1", 1, "Working as a physicist", "as"),
    ("p2", 2, "Mechanics", "as"),
    ("p3", 3, "Electric circuits", "as"),
    ("p4", 4, "Materials", "as"),
    ("p5", 5, "Waves and the particle nature of light", "as"),
    ("p6", 6, "Further mechanics", "a2"),
    ("p7", 7, "Electric and magnetic fields", "a2"),
    ("p8", 8, "Nuclear and particle physics", "a2"),
    ("p9", 9, "Thermodynamics", "a2"),
    ("p10", 10, "Space", "a2"),
    ("p11", 11, "Nuclear radiation", "a2"),
    ("p12", 12, "Gravitational fields", "a2"),
    ("p13", 13, "Oscillations", "a2"),
]
GROUPS = [("as", "Topics 1–5 (AS content)"), ("a2", "Topics 6–13 (A level content)")]

P = {
 1: ["SI units, prefixes and homogeneity", "Estimation and orders of magnitude", "Uncertainties and errors",
     "Graphs, gradients and linearising data", "Practical skills and experiment design"],
 2: ["Motion graphs and the equations of motion", "Projectile motion", "Adding and resolving vectors",
     "Newton's laws and free-body diagrams", "Momentum", "Moments and centre of gravity",
     "Work, kinetic and gravitational potential energy", "Power and efficiency"],
 3: ["Current, charge and potential difference", "Resistance, Ohm's law and I-V graphs", "Resistivity",
     "Series and parallel circuits, Kirchhoff's laws", "Potential dividers and sensors (LDR, thermistor)",
     "EMF and internal resistance", "Electrical power and energy", "Charge carriers and I = nqvA"],
 4: ["Density, upthrust and flotation", "Viscosity and Stokes' law", "Hooke's law and elastic strain energy",
     "Stress, strain and the Young modulus", "Force-extension and stress-strain graphs"],
 5: ["Wave properties and v = fλ", "Transverse and longitudinal waves, intensity", "Superposition and standing waves",
     "Refraction and total internal reflection", "Lenses, power and magnification", "Polarisation",
     "Diffraction, interference and gratings", "Pulse-echo techniques", "Photons and the photoelectric effect",
     "Energy levels and line spectra", "Wave-particle duality and electron diffraction"],
 6: ["Impulse and momentum", "Collisions and conservation of momentum (including 2D)", "Circular motion"],
 7: ["Electric field strength and field lines", "Coulomb's law", "Electric potential and equipotentials",
     "Capacitance and energy stored", "Capacitor charge and discharge", "Magnetic flux density and forces on currents and charges",
     "Electromagnetic induction (Faraday and Lenz)", "Alternating current and r.m.s. values"],
 8: ["The nuclear atom and alpha particle scattering", "Particle accelerators and detectors",
     "Quarks, leptons and conservation laws", "Mass-energy and particle creation"],
 9: ["Specific heat capacity and latent heat", "Internal energy and absolute zero", "Ideal gases and kinetic theory"],
 10: ["Black body radiation (Stefan-Boltzmann and Wien)", "Hertzsprung-Russell diagram and stellar evolution",
      "Astronomical distances: parallax and standard candles", "Doppler shift, redshift and Hubble's law", "Cosmology and the fate of the universe"],
 11: ["Binding energy, fission and fusion", "Alpha, beta and gamma radiation, background radiation",
      "Radioactive decay, half-life and exponential decay"],
 12: ["Newton's law of gravitation and field strength", "Gravitational potential", "Orbits and satellites"],
 13: ["Simple harmonic motion: conditions and equations", "Energy and graphs in SHM", "Damping, forced oscillations and resonance"],
}

NAMES = {}
for _n, _pts in P.items():
    g = "as" if _n <= 5 else "a2"
    for _i, _name in enumerate(_pts, 1):
        NAMES.setdefault(g, {})[f"{_n}.{_i}"] = _name
