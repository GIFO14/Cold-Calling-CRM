import { CallOutcome, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const CALL_SCRIPT_LANGUAGE_OPTIONS = [
  { code: "ca", label: "Catala" },
  { code: "es", label: "Castellano" }
] as const;

const DEFAULT_SCRIPTS = {
  ca: {
    name: "Guio principal (Catala)",
    steps: [
      {
        position: 1,
        title: "Obertura",
        text: "Hola, soc en Marti. Et trucava perque he vist que oferiu serveis de Meta Ads."
      },
      {
        position: 2,
        title: "Context",
        text: "Et truco des de Kallflow, una plataforma que ajuda a convertir mes leads en reunions."
      },
      {
        position: 3,
        title: "Valor",
        text: "La idea es ajudar-vos a treure mes reunions dels leads que ja esteu generant pels clients."
      },
      {
        position: 4,
        title: "Pregunta",
        text: "Ara mateix feu algun seguiment per telefon o WhatsApp per convertir aquests leads?"
      }
    ],
    objections: [
      {
        position: 1,
        label: "No m'interessa",
        responses: [
          {
            position: 1,
            label: "Curta",
            text: "Cap problema. No et volia vendre res ara mateix, nomes validar si aixo podria tenir sentit com a servei complementari."
          },
          {
            position: 2,
            label: "Consultiva",
            text: "Perfecte. Justament per aixo t'ho preguntava curt: per veure si hi ha una oportunitat real o si no cal ni que hi tornem."
          }
        ]
      },
      {
        position: 2,
        label: "Ja tenim algu",
        responses: [
          {
            position: 1,
            label: "Reforc",
            text: "Perfecte. En aquest cas podria encaixar com a reforc de conversio sense tocar el que ja us esta funcionant."
          }
        ]
      },
      {
        position: 3,
        label: "Envia'm info",
        responses: [
          {
            position: 1,
            label: "Filtre",
            text: "Te'n puc enviar, pero abans em va millor entendre en 20 segons si realment us encaixa o et faria perdre el temps."
          },
          {
            position: 2,
            label: "Curiositat",
            text: "Cap problema. Si vols, t'envio info, pero abans et faig una pregunta molt curta per no enviar-te una cosa que no et serveixi."
          }
        ]
      },
      {
        position: 4,
        label: "Truca mes tard",
        responses: [
          {
            position: 1,
            label: "Reagendar",
            text: "Cap problema. Quin seria millor moment, dema al mati o a la tarda?"
          }
        ]
      },
      {
        position: 5,
        label: "No es el moment",
        responses: [
          {
            position: 1,
            label: "Ultra curta",
            text: "Totalment. Precisament per no allargar-ho, nomes et faria una pregunta i et deixo."
          }
        ]
      }
    ]
  },
  es: {
    name: "Guion principal (Castellano)",
    steps: [
      {
        position: 1,
        title: "Apertura",
        text: "Hola, soy Marti. Te llamaba porque he visto que ofrecéis servicios de Meta Ads."
      },
      {
        position: 2,
        title: "Contexto",
        text: "Te llamo desde Kallflow, una plataforma que ayuda a convertir mas leads en reuniones."
      },
      {
        position: 3,
        title: "Valor",
        text: "La idea es ayudaros a sacar mas reuniones de los leads que ya estais generando para los clientes."
      },
      {
        position: 4,
        title: "Pregunta",
        text: "Ahora mismo haceis algun seguimiento por telefono o WhatsApp para convertir esos leads?"
      }
    ],
    objections: [
      {
        position: 1,
        label: "No me interesa",
        responses: [
          {
            position: 1,
            label: "Corta",
            text: "Sin problema. No te queria vender nada ahora mismo, solo validar si esto podria tener sentido como servicio complementario."
          },
          {
            position: 2,
            label: "Consultiva",
            text: "Perfecto. Justo por eso te lo preguntaba rapido: para ver si hay una oportunidad real o si no hace falta ni que volvamos a hablarlo."
          }
        ]
      },
      {
        position: 2,
        label: "Ya tenemos a alguien",
        responses: [
          {
            position: 1,
            label: "Refuerzo",
            text: "Perfecto. En ese caso podria encajar como refuerzo de conversion sin tocar lo que ya os esta funcionando."
          }
        ]
      },
      {
        position: 3,
        label: "Enviame info",
        responses: [
          {
            position: 1,
            label: "Filtro",
            text: "Te la puedo enviar, pero antes prefiero entender en 20 segundos si realmente os encaja o te haria perder el tiempo."
          },
          {
            position: 2,
            label: "Curiosidad",
            text: "Sin problema. Si quieres te envio info, pero antes te hago una pregunta muy corta para no mandarte algo que no te sirva."
          }
        ]
      },
      {
        position: 4,
        label: "Llama mas tarde",
        responses: [
          {
            position: 1,
            label: "Reagendar",
            text: "Sin problema. Que te iria mejor, manana por la manana o por la tarde?"
          }
        ]
      },
      {
        position: 5,
        label: "No es el momento",
        responses: [
          {
            position: 1,
            label: "Ultra corta",
            text: "Totalmente. Precisamente para no alargarlo, solo te haria una pregunta y te dejo."
          }
        ]
      }
    ]
  }
} as const;

export const POSITIVE_SCRIPT_OUTCOMES: CallOutcome[] = [
  "INTERESTED",
  "CALL_BACK",
  "MEETING_BOOKED"
];

export const ACTIVE_CALL_SCRIPT_INCLUDE = {
  steps: {
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      choices: {
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    }
  },
  objections: {
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      choices: {
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      },
      responses: {
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
      }
    }
  }
} satisfies Prisma.CallScriptInclude;

export const CALL_SCRIPT_SESSION_INCLUDE = {
  script: {
    include: ACTIVE_CALL_SCRIPT_INCLUDE
  },
  selectedObjection: true,
  selectedResponse: true
} satisfies Prisma.CallScriptSessionInclude;

export function normalizeCallScriptLanguage(languageCode: string | null | undefined) {
  const normalized = String(languageCode ?? "ca").trim().toLowerCase();
  return CALL_SCRIPT_LANGUAGE_OPTIONS.some((item) => item.code === normalized) ? normalized : "ca";
}

function getDefaultScript(languageCode: string) {
  const normalizedLanguage = normalizeCallScriptLanguage(languageCode) as keyof typeof DEFAULT_SCRIPTS;
  return DEFAULT_SCRIPTS[normalizedLanguage] ?? DEFAULT_SCRIPTS.ca;
}

export async function ensureActiveCallScript(createdById?: string, languageCode = "ca") {
  const normalizedLanguage = normalizeCallScriptLanguage(languageCode);
  const existing = await prisma.callScript.findUnique({
    where: { languageCode: normalizedLanguage },
    include: ACTIVE_CALL_SCRIPT_INCLUDE
  });

  if (existing) return existing;

  const defaultScript = getDefaultScript(normalizedLanguage);
  const created = await prisma.callScript.create({
    data: {
      name: defaultScript.name,
      languageCode: normalizedLanguage,
      isActive: true,
      createdById,
      steps: {
        create: defaultScript.steps.map((step) => ({
          position: step.position,
          title: step.title,
          text: step.text
        }))
      },
      objections: {
        create: defaultScript.objections.map((objection) => ({
          position: objection.position,
          label: objection.label,
          responses: {
            create: objection.responses.map((response) => ({
              position: response.position,
              label: response.label,
              text: response.text
            }))
          }
        }))
      }
    },
    include: ACTIVE_CALL_SCRIPT_INCLUDE
  });

  return created;
}

export async function getActiveCallScript(languageCode?: string) {
  return prisma.callScript.findFirst({
    where: {
      isActive: true,
      ...(languageCode ? { languageCode: normalizeCallScriptLanguage(languageCode) } : {})
    },
    orderBy: { createdAt: "asc" },
    include: ACTIVE_CALL_SCRIPT_INCLUDE
  });
}

export async function ensureDefaultLanguageScripts(createdById?: string) {
  return Promise.all(CALL_SCRIPT_LANGUAGE_OPTIONS.map((item) => ensureActiveCallScript(createdById, item.code)));
}

export function chooseRandomResponse<T>(responses: T[]) {
  if (responses.length === 0) return null;
  const index = Math.floor(Math.random() * responses.length);
  return responses[index] ?? null;
}

export async function closeCallScriptSessionByCallLogId(callLogId: string, reason: string) {
  const session = await prisma.callScriptSession.findUnique({
    where: { callLogId }
  });

  if (!session || session.status !== "ACTIVE") {
    return session;
  }

  return prisma.callScriptSession.update({
    where: { id: session.id },
    data: {
      status: "CALL_ENDED",
      endedAt: new Date(),
      endReason: reason,
      pane: "SCRIPT",
      selectedObjectionId: null,
      selectedResponseId: null,
      events: {
        create: {
          type: "SESSION_CLOSED",
          stepPosition: session.currentStepIndex + 1,
          metadata: { reason }
        }
      }
    }
  });
}
