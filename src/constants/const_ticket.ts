import type { Ticket } from "../types/Ticket";

export const STATUSES: Ticket["status"][] = [
  "Pendiente",
  "En Ejecución",
  "Finalizadas",
];

//TODO:Eliminar bloque de codigo ya no se utiliza.
export const RESPONSABLES_SECCIONES: Record<string, string[]> = {
  "SIN ASIGNAR": ["<< SIN ASIGNAR >>"],
  "Internos": [
    "Edwin Brito",
    "Anibelka Varga",
    "Miguel Angel Castro",
    "Yeicor Yamel Castillo Feliz",
    "Joel Mieses",
    "Aneudy Jesus Altagracia",
    "Antonio Riveras",
    "Estarlin Javier Suero",
    "Ostakio Veloz Ramón",
    "Jenssy Leroy",
    "Richardson Minaya",
  ],
  "TERCEROS": [
    "Angel Pinales Corporan",
    "Carlos Manuel de Sena Reyes",
    "Daniel Cordero Nuñez",
    "Elixandro Nova Beriguete",
    "Francisco Natera Ramirez",
    "Jose Castillo Paula",
    "Jose Luis Garcia Taveraz",
    "Jose Ramon Almonte",
    "Junior de Leon",
    "Luis Vasquez Zapata",
    "Miguel Angel Castillo Feliz",
    "Pedro Jose Frías (El mello)",
    "Pedro Pineda",
    "Ramon del Carmen Zapata Ureña",
    "Ugo Santo Gobessi",
    "Vianela Castillo Castillo",
    "Weldyn Martinez",
  ]
};