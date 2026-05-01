import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AdvanceInput = {
  targetType: "STEP" | "OBJECTION" | "TERMINAL";
  targetKey?: string;
  terminalLabel?: string;
};

type StepInput = {
  key: string;
  position: number;
  title: string;
  text: string;
  advance?: AdvanceInput;
};

type ObjectionInput = {
  key: string;
  position: number;
  label: string;
  responseText: string;
};

type ChoiceInput = {
  sourceType: "STEP" | "OBJECTION";
  sourceKey: string;
  position: number;
  label: string;
  targetType: "STEP" | "OBJECTION" | "TERMINAL";
  targetKey?: string;
  terminalLabel?: string;
};

const steps: StepInput[] = [
  {
    key: "B0",
    position: 1,
    title: "B0 · SECRETARÍA",
    text: "Hola, {NOM PROPIETARI}, por favor."
  },
  {
    key: "B0_NAMELESS_OPEN",
    position: 2,
    title: "B0 · Sin nombre del propietario",
    text: "Hola, buenas. ¿Me puedes decir el nombre de la persona que lleva la agencia?"
  },
  {
    key: "B0_NAMELESS_THANKS",
    position: 3,
    title: "B0 · Gracias por el nombre",
    text: "Muchas gracias.",
    advance: { targetType: "TERMINAL", terminalLabel: "Volver a llamar con nombre" }
  },
  {
    key: "B0_NAMELESS_PARA",
    position: 4,
    title: "B0 · Para qué es",
    text: "Para enviarle algo. Muchas gracias.",
    advance: { targetType: "TERMINAL", terminalLabel: "Volver a llamar con nombre" }
  },
  {
    key: "B0_QUIEN_LLAMA",
    position: 5,
    title: "B0 · ¿Quién le llama?",
    text: "{NOM} {COGNOM}."
  },
  {
    key: "B0_DONDE_LLAMA",
    position: 6,
    title: "B0 · ¿De dónde llama?",
    text: "De Barcelona."
  },
  {
    key: "B0_EMPRESA",
    position: 7,
    title: "B0 · ¿De parte de qué empresa?",
    text: "Kallflow."
  },
  {
    key: "B0_TEMA",
    position: 8,
    title: "B0 · ¿De qué tema se trata?",
    text: "Es un tema que prefiero comentar directamente con él."
  },
  {
    key: "B0_INSISTE",
    position: 9,
    title: "B0 · Insiste una vez más",
    text: "Es un tema de su empresa que prefiero comentar con él."
  },
  {
    key: "B0_CLOSE",
    position: 10,
    title: "B0 · Cierre con secretaría",
    text: "De acuerdo, ya llamaré más tarde. Gracias.",
    advance: { targetType: "TERMINAL", terminalLabel: "Ya llamaré más tarde" }
  },
  {
    key: "B1_SIN_NOM",
    position: 11,
    title: "B1 · Obertura + pattern interrupt (sin nombre)",
    text: "Hola, soy Martí — ya sé que te llamo sin avisar, ¿te pillo en mal momento?"
  },
  {
    key: "B1",
    position: 12,
    title: "B1 · Obertura + pattern interrupt",
    text: "Hola {NOM}, soy Martí — ya sé que te llamo sin avisar, ¿te pillo en mal momento?"
  },
  {
    key: "B1_R2_KALLFLOW",
    position: 13,
    title: "B1 · ¿Quién eres?",
    text: "Te llamo desde Kallflow.",
    advance: { targetType: "STEP", targetKey: "B2" }
  },
  {
    key: "HORA1",
    position: 14,
    title: "B1 · Reagendar",
    text: "Sin problema, no te entretengo. ¿Cuándo te va bien que te llame — esta tarde o mañana a primera hora?"
  },
  {
    key: "HORA1_CONFIRM",
    position: 15,
    title: "B1 · Confirmar hora",
    text: "Perfecto, te llamo a las {HORA}. Que vaya bien.",
    advance: { targetType: "TERMINAL", terminalLabel: "Callback programado" }
  },
  {
    key: "B1_R4_NUMERO",
    position: 16,
    title: "B1 · ¿Cómo has conseguido mi número?",
    text: "Lo encontré en vuestra web / LinkedIn. Te llamo porque he visto que hacéis campañas de Meta y Google.",
    advance: { targetType: "STEP", targetKey: "B2" }
  },
  {
    key: "B2",
    position: 17,
    title: "B2 · PERMISO",
    text: "Mira, te llamo en frío — te lo digo directamente. ¿Me regalas 30 segundos y ya decides si te interesa o no?"
  },
  {
    key: "HORA2",
    position: 18,
    title: "B2 · Reagendar",
    text: "Entendido. ¿Cuándo te va mejor, esta tarde o mañana?"
  },
  {
    key: "HORA2_CONFIRM",
    position: 19,
    title: "B2 · Confirmar hora",
    text: "Perfecto, te llamo a las {HORA}. ¿El número que me has cogido es el mejor para localizarte?",
    advance: { targetType: "TERMINAL", terminalLabel: "Callback programado" }
  },
  {
    key: "B2_R3",
    position: 20,
    title: "B2 · ¿De qué se trata?",
    text: "Justo eso te iba a contar en 30 segundos. ¿Te parece?",
    advance: { targetType: "STEP", targetKey: "B3" }
  },
  {
    key: "B2_R4_PUSH",
    position: 21,
    title: "B2 · No me interesa antes de escuchar",
    text: "Lo entiendo — aún no te he dicho nada. Dame 20 segundos, si no te encaja cuelgas y no te molesto más."
  },
  {
    key: "B3",
    position: 22,
    title: "B3 · PITCH",
    text: "He visto que en {AGÈNCIA} hacéis lead gen con Meta y Google. Hemos montado un sistema que llama al lead en menos de 60 segundos desde que rellena el formulario — antes de que se enfríe. Las agencias que lo ofrecen lo venden como un add-on a sus clientes y suben el ROI de las campañas que ya les venden. ¿Te suena interesante o te lo explico mejor?"
  },
  {
    key: "B3_Q_EXACTO",
    position: 23,
    title: "B3 · ¿Qué es exactamente?",
    text: "Es un agente de voz — una llamada automática que suena como una persona, sale al segundo de que el lead rellena el formulario, lo cualifica con las preguntas que quieras, y agenda una reunión directamente en el calendario del cliente. Todo solo.",
    advance: { targetType: "STEP", targetKey: "B4" }
  },
  {
    key: "B3_Q_60",
    position: 24,
    title: "B3 · ¿Por qué 60 segundos?",
    text: "Está documentado que el primer minuto es crítico — la conversión cae en picado a partir de los 5 minutos. El problema es que nadie lo puede hacer manualmente, no tienes a alguien mirando el CRM las 24 horas.",
    advance: { targetType: "STEP", targetKey: "B4" }
  },
  {
    key: "B3_Q_IA",
    position: 25,
    title: "B3 · ¿Esto es una IA?",
    text: "Sí, es IA — y en España se identifica como tal, que es lo que toca. Lo que sí te puedo decir es que suena muy realista. En la demo te llama directamente y lo juzgas tú mismo.",
    advance: { targetType: "STEP", targetKey: "B4" }
  },
  {
    key: "B3_Q_OTRAS",
    position: 26,
    title: "B3 · ¿Quién lo está haciendo?",
    text: "Es un servicio que las agencias están empezando a ofrecer ahora mismo, sobre todo en Madrid y Barcelona. Es el tipo de cosa que cuando uno empieza, los clientes se lo empiezan a pedir a todos los demás — los que se mueven primero se quedan con el diferencial.",
    advance: { targetType: "STEP", targetKey: "B4" }
  },
  {
    key: "B4",
    position: 27,
    title: "B4 · DISCOVERY",
    text: "Oye, para ver si esto os encaja — ¿cómo lo gestionáis ahora? Cuando un lead entra en el formulario de un cliente, ¿cómo llega hasta él?"
  },
  {
    key: "B4_R1",
    position: 28,
    title: "B4 · Va directo al cliente",
    text: "Exacto, lo típico. Y el cliente luego llama cuando puede — a veces tarda horas.",
    advance: { targetType: "STEP", targetKey: "B4_GAP" }
  },
  {
    key: "B4_R2",
    position: 29,
    title: "B4 · CRM / Hubspot / automatización",
    text: "Sí, el CRM manda el email o el SMS automático. Lo nuestro es diferente — es una llamada de voz real, el agente conversa, cualifica y agenda. El email lo ignoran, la llamada no.",
    advance: { targetType: "STEP", targetKey: "B4_GAP" }
  },
  {
    key: "B4_R3",
    position: 30,
    title: "B4 · Solo generamos el lead",
    text: "Tiene sentido. Lo que estamos viendo es que las agencias que lo ofrecen lo venden como un add-on — el cliente lo contrata a través de vosotros, os quedáis con un margen y el cliente ve más ROI en las campañas.",
    advance: { targetType: "STEP", targetKey: "B4_GAP" }
  },
  {
    key: "B4_R4",
    position: 31,
    title: "B4 · No lo sé / silencio",
    text: "No hay problema.",
    advance: { targetType: "STEP", targetKey: "B4_GAP" }
  },
  {
    key: "B4_GAP",
    position: 32,
    title: "B4 · Pregunta gap",
    text: "Oye, una cosa — ¿alguna vez se ha dado el caso de que un lead entró de noche o un fin de semana y el cliente tardó más de un día en responder?"
  },
  {
    key: "B4_GAP_YES",
    position: 33,
    title: "B4 · Gap detectado",
    text: "Eso es exactamente el gap que resolvemos.",
    advance: { targetType: "STEP", targetKey: "B4_VOLUME" }
  },
  {
    key: "B4_GAP_NO",
    position: 34,
    title: "B4 · Proceso cubierto",
    text: "Qué bien. Entonces tenéis el proceso muy bien cubierto. ¿Con qué sistema lo gestionáis?",
    advance: { targetType: "STEP", targetKey: "B4_VOLUME" }
  },
  {
    key: "B4_VOLUME",
    position: 35,
    title: "B4 · Pregunta de volumen",
    text: "Y para hacerme una idea — ¿cuántos leads al mes generáis aproximadamente entre todos vuestros clientes? Un rango aproximado me sirve.",
    advance: { targetType: "STEP", targetKey: "B45" }
  },
  {
    key: "B45",
    position: 36,
    title: "B4.5 · SOFT TRANSITION",
    text: "Basándome en lo que me estás contando — ¿puedo mostrarte lo que están haciendo otras agencias en tu situación para resolver eso? Son 15 minutos, te enseño cómo funciona y también te cuento a cuánto lo están vendiendo a sus clientes."
  },
  {
    key: "B45_R2",
    position: 37,
    title: "B4.5 · ¿Qué me vas a mostrar?",
    text: "Te hago una demo en directo — yo relleno un formulario de prueba y a los 30 segundos te llama el agente en tu móvil. Lo escuchas tú mismo. Y también te cuento a cuánto lo están vendiendo otras agencias a sus clientes, para que tengas el contexto completo.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "B5",
    position: 38,
    title: "B5 · CTA",
    text: "¿Te va bien el {DIA} a las {HORA}, o prefieres el {DIA2}?"
  },
  {
    key: "B5_R1_DETAILS",
    position: 39,
    title: "B5 · Confirmar llamada y email",
    text: "Perfecto. ¿El número que tengo es el mejor para la llamada, o prefieres otro? Y dime tu email que te mando la confirmación.",
    advance: { targetType: "STEP", targetKey: "CLOSE_DEMO_EMAIL" }
  },
  {
    key: "B5_NEXT",
    position: 40,
    title: "B5 · Semana que viene",
    text: "Sin problema. ¿La semana que viene te va mejor — el lunes o el martes?"
  },
  {
    key: "B5_R3_CAL",
    position: 41,
    title: "B5 · Calendly",
    text: "No hay problema. ¿Te mando un enlace de Calendly para que reserves cuando puedas? ¿A qué email?",
    advance: { targetType: "STEP", targetKey: "CAL_CLOSE" }
  },
  {
    key: "CAL_CLOSE",
    position: 42,
    title: "B5 · Cierre con Calendly",
    text: "Te lo mando ahora mismo. Que vaya bien.",
    advance: { targetType: "TERMINAL", terminalLabel: "Enviar Calendly" }
  },
  {
    key: "CLOSE_DEMO_EMAIL",
    position: 43,
    title: "Tancament · Confirmación email",
    text: "Perfecto. El {DIA} a las {HORA}. ¿Te mando la confirmación al email — cuál es?",
    advance: { targetType: "STEP", targetKey: "B6_WHATSAPP" }
  },
  {
    key: "B6_WHATSAPP",
    position: 44,
    title: "B6 · WhatsApp",
    text: "Genial. Te mando ahora mismo la invitación al calendario y un WhatsApp con el enlace de la videollamada. ¿El número que tengo es bueno para el WhatsApp?",
    advance: { targetType: "STEP", targetKey: "B6_FINAL" }
  },
  {
    key: "B6_FINAL",
    position: 45,
    title: "B6 · Cierre final",
    text: "Perfecto. {NOM}, hablamos el {DIA} a las {HORA}. Que vaya bien.",
    advance: { targetType: "TERMINAL", terminalLabel: "Demo agendada" }
  },
  {
    key: "OA2",
    position: 46,
    title: "A · Paso 2",
    text: "¿Os ha pasado alguna vez que un cliente se queja de que los leads que le traéis no convierten bien — que cuando les llama ya están fríos?"
  },
  {
    key: "OA2_YES_ACK",
    position: 47,
    title: "A · Gap detectado",
    text: "Eso es exactamente el gap que resolvemos.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OA3",
    position: 48,
    title: "A · Paso 3",
    text: "Lo entiendo. ¿Y vosotros ya les ofrecéis a vuestros clientes algún tipo de seguimiento automatizado del lead, o eso queda en manos de ellos?"
  },
  {
    key: "OA3_YES_HOW",
    position: 49,
    title: "A · ¿Cómo lo tenéis montado?",
    text: "¿Cómo lo tenéis montado?"
  },
  {
    key: "OA3_NO_CLIENT",
    position: 50,
    title: "A · Lo gestiona el cliente",
    text: "Eso es justo lo que más nos piden las agencias — poder ofrecer ese paso también.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OA4_CLOSE",
    position: 51,
    title: "A · Cierre",
    text: "Sin problema, lo entiendo. Si en algún momento lo veis, ya sabéis dónde estamos. Que vaya bien.",
    advance: { targetType: "TERMINAL", terminalLabel: "Sin interés" }
  },
  {
    key: "OB_B_EMAIL",
    position: 52,
    title: "B · Email / SMS",
    text: "Eso es seguimiento, no contacto inmediato de voz. La diferencia es que el agente llama — conversa, cualifica y agenda. Un email a las 3 de la mañana no hace eso.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OB_B_MANUAL",
    position: 53,
    title: "B · Llamadas manuales",
    text: "¿Las 24 horas, incluso si el lead entra a las 11 de la noche o un domingo? Eso es justo donde está el gap.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OB_B_AGENT_SETUP",
    position: 54,
    title: "B · Tienen agente de voz",
    text: "Interesante. ¿Os lo habéis montado vosotros o es una plataforma externa?",
    advance: { targetType: "STEP", targetKey: "OB_B_AGENT_PERF" }
  },
  {
    key: "OB_B_AGENT_PERF",
    position: 55,
    title: "B · ¿Qué tal os está funcionando?",
    text: "¿Y qué tal os está funcionando?"
  },
  {
    key: "OB_B_AGENT_LT60_Q",
    position: 56,
    title: "B · ¿Llama en menos de 60 segundos?",
    text: "Me alegra. ¿Y llama al lead en menos de 60 segundos desde que entra el formulario?"
  },
  {
    key: "OB_B_AGENT_COVERED",
    position: 57,
    title: "B · Lo tienen cubierto",
    text: "Entonces lo tenéis muy bien montado. Si en algún momento queréis comparar, aquí estamos. Que vaya bien.",
    advance: { targetType: "TERMINAL", terminalLabel: "No oportunidad" }
  },
  {
    key: "OB_B_AGENT_GAP",
    position: 58,
    title: "B · Gap de velocidad",
    text: "Ahí está el gap — ese primer minuto es el que más impacta en la conversión.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OB_B_AGENT_PROBLEM_Q",
    position: 59,
    title: "B · ¿Qué es lo que no funciona?",
    text: "¿Qué es lo que no os acaba de funcionar?"
  },
  {
    key: "OB_B_AGENT_WISH_Q",
    position: 60,
    title: "B · ¿Qué te gustaría que hiciera diferente?",
    text: "¿Hay algo que os gustaría que hiciera diferente?"
  },
  {
    key: "OB_B_PROB_ROBOTIC",
    position: 61,
    title: "B · Voz robótica",
    text: "Es uno de los puntos clave. En la demo te llama el agente directamente al móvil y lo juzgas tú mismo.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OB_B_PROB_INTEGRATION",
    position: 62,
    title: "B · Integración",
    text: "Eso es justo lo que resolvemos — la integración con el formulario es el punto de partida, es lo primero que configuramos.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OB_B_PROB_SPEED",
    position: 63,
    title: "B · Tarda demasiado",
    text: "Ahí está el gap — el nuestro llama en menos de 60 segundos desde que entra el lead. En la demo lo ves en tiempo real.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OB_B_PROB_IA",
    position: 64,
    title: "B · Quejas por IA",
    text: "En España el agente se identifica como IA, que es lo que toca. Lo que marca la diferencia es lo natural que suena — en la demo lo escuchas y decides si encaja.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OB_B_PROB_EXPENSIVE_Q",
    position: 65,
    title: "B · Es caro",
    text: "¿Cuánto estáis pagando ahora?",
    advance: { targetType: "STEP", targetKey: "OB_B_PROB_EXPENSIVE_ACK" }
  },
  {
    key: "OB_B_PROB_EXPENSIVE_ACK",
    position: 66,
    title: "B · Coste por lead",
    text: "Con ese volumen de leads, en la demo te hago los números para que veas el coste por lead contactado.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OB_B_PROB_COMPLEX",
    position: 67,
    title: "B · Complicado de gestionar",
    text: "Eso es lo que más nos dicen cuando vienen de montárselo ellos mismos. Nosotros lo configuramos todo — solo necesito un par de horas tuyas para las preguntas básicas.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OC_CONTACT_FOLLOWUP",
    position: 68,
    title: "C · Mejor llamarle o escribirle",
    text: "Genial, ¿sabes si es mejor llamarle o escribirle por email?",
    advance: { targetType: "TERMINAL", terminalLabel: "Contactar decision maker" }
  },
  {
    key: "OD_CONFIRM",
    position: 69,
    title: "D · Confirmar barrera",
    text: "Entonces si entiendo bien, lo único que nos separa de seguir adelante es {EL QUE HAN DIT}. ¿Es así? Si pudiéramos resolver eso, ¿estarías listo para avanzar?"
  },
  {
    key: "OD_MORE",
    position: 70,
    title: "D · Qué más te preocupa",
    text: "¿Qué más te preocupa?",
    advance: { targetType: "TERMINAL", terminalLabel: "Seguir explorando manualmente" }
  },
  {
    key: "OD_BUSY",
    position: 71,
    title: "D · Estamos muy ocupados",
    text: "Lo entiendo. Pero estar muy ocupado es exactamente la razón por la que esto tiene sentido — el sistema trabaja solo mientras vosotros hacéis otras cosas. ¿Cuánto tiempo pierde vuestro cliente cada semana persiguiendo leads que ya están fríos?",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OD_QUARTER",
    position: 72,
    title: "D · Próximo trimestre",
    text: "Entiendo los ciclos de presupuesto. Una pregunta rápida — ¿cuántos leads están entrando ahora mismo sin que nadie los llame en el primer minuto? Cada semana que pasa son clientes que van a la competencia.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OE_DEMO_REDIRECT",
    position: 73,
    title: "E · Redirigir a demo",
    text: "Con ese volumen tiene mucho más sentido que lo veas en directo — son 15 minutos, yo monto el formulario, y a los 30 segundos te llama el agente. Eso no se explica bien en un email."
  },
  {
    key: "OE_FOLLOWUP",
    position: 74,
    title: "E · Cerrar follow-up",
    text: "Sin problema, te lo mando. Y para no dejarlo en el aire — ¿cuándo te va bien que te llame para ver si te ha surgido alguna duda, el {DIA} o el {DIA2}?"
  },
  {
    key: "OE_FOLLOWUP_HOUR",
    position: 75,
    title: "E · Hora de follow-up",
    text: "Perfecto, te llamo el {DIA} a las {HORA}. ¿A qué email te lo mando?",
    advance: { targetType: "TERMINAL", terminalLabel: "Enviar email + callback" }
  },
  {
    key: "OE_FOLLOWUP_NO_HOUR",
    position: 76,
    title: "E · Sin hora de follow-up",
    text: "Sin problema. Te lo mando y si te surge alguna duda, me llamas. ¿A qué dirección?",
    advance: { targetType: "TERMINAL", terminalLabel: "Enviar email" }
  },
  {
    key: "OF_CLIENTS",
    position: 77,
    title: "F · Clientes que ya lo usan",
    text: "Sí, estamos trabajando con agencias en diferentes sectores. En la demo también te cuento cómo lo están estructurando y a qué precio lo venden a sus clientes.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OH_ACK",
    position: 78,
    title: "H · Con ese volumen",
    text: "Con ese volumen, en la demo te explico las opciones y vemos qué estructura tiene más sentido para vosotros y para vuestros clientes.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OK_FAST_Q",
    position: 79,
    title: "K · ¿En menos de 60 segundos?",
    text: "¿En menos de 60 segundos desde que entra el formulario?"
  },
  {
    key: "OK_COVERED",
    position: 80,
    title: "K · Lo tienen bien cubierto",
    text: "Entonces lo tienen muy bien cubierto. Si en algún momento cambia, acuérdate de nosotros. Que vaya bien.",
    advance: { targetType: "TERMINAL", terminalLabel: "No oportunidad" }
  },
  {
    key: "OK_GAP",
    position: 81,
    title: "K · Primer minuto crítico",
    text: "Ahí está el gap — ese primer minuto es el que más impacta en la conversión.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OK_EMAIL",
    position: 82,
    title: "K · CRM / email automático",
    text: "El email está bien para seguimiento, pero no es lo mismo que una llamada de voz en ese primer momento — el agente llama, conversa y cualifica. Un email en ese primer minuto crítico no tiene el mismo impacto.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OK_HUMAN",
    position: 83,
    title: "K · Tienen a alguien que llama",
    text: "¿Y también los fines de semana y cuando el lead entra a las 11 de la noche? Eso es justo el gap — el agente cubre los momentos en que no hay nadie disponible.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OK_VISIBILITY_Q",
    position: 84,
    title: "K · ¿Tenéis visibilidad?",
    text: "Entiendo. ¿Y vosotros tenéis visibilidad de con qué rapidez responden?"
  },
  {
    key: "OK_VISIBILITY_NO",
    position: 85,
    title: "K · Vale la pena mirarlo",
    text: "Eso vale la pena mirarlo — en la demo te explico cómo funciona y cómo lo podríais ofrecer como servicio extra encima de lo que ya hacéis.",
    advance: { targetType: "STEP", targetKey: "B5" }
  },
  {
    key: "OK_VISIBILITY_OK",
    position: 86,
    title: "K · Si cambia algo",
    text: "Si en algún momento cambia algo, aquí estamos. Que vaya bien.",
    advance: { targetType: "TERMINAL", terminalLabel: "No oportunidad" }
  },
  {
    key: "OK_OTHER_IA_Q",
    position: 87,
    title: "K · Otra IA / sistema automatizado",
    text: "¿Y llama en menos de 60 segundos desde que entra el lead?"
  },
  {
    key: "OK_OTHER_IA_COVERED",
    position: 88,
    title: "K · Otra IA bien cubierta",
    text: "Entonces lo tienen muy bien cubierto. Que vaya bien.",
    advance: { targetType: "TERMINAL", terminalLabel: "No oportunidad" }
  },
  {
    key: "OK_OTHER_IA_GAP",
    position: 89,
    title: "K · Otra IA con gap",
    text: "Ahí está el gap — ese primer minuto es el que más impacta.",
    advance: { targetType: "STEP", targetKey: "B5" }
  }
];

const objections: ObjectionInput[] = [
  {
    key: "A",
    position: 1,
    label: "A · No me interesa",
    responseText:
      "Lo entiendo. ¿Me puedo quedar con una pregunta? ¿Es que no veis el caso de uso para vuestros clientes, o es más una cuestión de que ahora no es el momento?"
  },
  {
    key: "B",
    position: 2,
    label: "B · Ya tenemos algo",
    responseText: "Me alegra escucharlo. ¿Cómo lo tenéis montado, si se puede saber?"
  },
  {
    key: "C",
    position: 3,
    label: "C · No es mi decisión",
    responseText:
      "Perfecto. ¿Podrías pasarme con {PERSONA}, o me das su contacto? También puedo agendar la demo contigo y con él/ella a la vez — así no tenéis que repetir la conversación dos veces."
  },
  {
    key: "D",
    position: 4,
    label: "D · Llámame luego / En otro momento / Ahora no es el momento",
    responseText:
      "Entiendo, el timing es importante. ¿Puedo preguntarte qué es específicamente lo que hace que no sea el momento — es algo de presupuesto, de prioridades, o algo del sistema en sí?"
  },
  {
    key: "E",
    position: 5,
    label: "E · Mándame info por email",
    responseText:
      "Claro, te lo mando. Antes, para no enviarte algo genérico — ¿cuántos leads al mes generáis aproximadamente para vuestros clientes?"
  },
  {
    key: "F",
    position: 6,
    label: "F · ¿Esto realmente funciona?",
    responseText:
      "La mejor forma de verlo es en directo — en la demo yo relleno un formulario de prueba y a los 30 segundos recibes la llamada del agente en tu móvil. Lo juzgas tú mismo."
  },
  {
    key: "G",
    position: 7,
    label: "G · Nuestros clientes no van a querer esto",
    responseText:
      "Es una pregunta que me hacen mucho. Lo que vemos es que cuando el lead acaba de rellenar el formulario y recibe una llamada en 30 segundos, la primera reacción es positiva — acaban de pedir ser contactados. El problema es cuando llaman 4 horas después.\n\nY si te preocupa cómo suena — en la demo lo escuchas tú mismo y decides si encajaría con tus clientes."
  },
  {
    key: "H",
    position: 8,
    label: "H · ¿Cuánto cuesta?",
    responseText:
      "Depende del volumen y de cómo lo estructuréis con vuestros clientes — hay varias opciones. Antes de darte un número, déjame entender vuestro caso: ¿cuántos leads al mes generáis aproximadamente?"
  },
  {
    key: "I",
    position: 9,
    label: "I · No tenemos presupuesto",
    responseText:
      "Entiendo. El modelo que más usan las agencias es pasárselo al cliente — vosotros lo montáis y cobráis un margen. No sale de vuestro presupuesto. ¿Te cuento cómo funciona eso en la demo?"
  },
  {
    key: "J",
    position: 10,
    label: "J · Es muy complicado de implementar / integrar con nuestros sistemas",
    responseText:
      "Lo entiendo, es una preocupación normal. La plataforma la usáis vosotros, pero está pensada para que no necesitéis saber programar — se construye con un asistente de IA integrado que te guía paso a paso.\n\nAdemás, os damos plantillas de agentes reales que ya funcionan para casos de uso como el vuestro — no empezáis de cero. Y cada vez que lo necesitéis, el asistente os ayuda a construirlo, testearlo y monitorizarlo.\n\nEn la demo lo ves en directo y decides si lo veis manejable."
  },
  {
    key: "K",
    position: 11,
    label: "K · Mis clientes ya tienen su propio sistema de seguimiento de leads",
    responseText: "Puede ser. ¿Con qué velocidad responden — llaman al lead en el primer minuto?"
  }
];

const choices: ChoiceInput[] = [
  { sourceType: "STEP", sourceKey: "B0", position: 1, label: "Te pasa con el propietario", targetType: "STEP", targetKey: "B1" },
  { sourceType: "STEP", sourceKey: "B0", position: 2, label: "¿Quién le llama?", targetType: "STEP", targetKey: "B0_QUIEN_LLAMA" },
  { sourceType: "STEP", sourceKey: "B0", position: 3, label: "¿De dónde llama?", targetType: "STEP", targetKey: "B0_DONDE_LLAMA" },
  { sourceType: "STEP", sourceKey: "B0", position: 4, label: "¿De parte de qué empresa?", targetType: "STEP", targetKey: "B0_EMPRESA" },
  { sourceType: "STEP", sourceKey: "B0", position: 5, label: "¿De qué tema se trata?", targetType: "STEP", targetKey: "B0_TEMA" },
  { sourceType: "STEP", sourceKey: "B0", position: 6, label: "Insiste otra vez", targetType: "STEP", targetKey: "B0_INSISTE" },
  { sourceType: "STEP", sourceKey: "B0", position: 7, label: "Sigue insistiendo", targetType: "STEP", targetKey: "B0_CLOSE" },
  { sourceType: "STEP", sourceKey: "B0", position: 8, label: "No tengo el nombre", targetType: "STEP", targetKey: "B0_NAMELESS_OPEN" },

  { sourceType: "STEP", sourceKey: "B0_NAMELESS_OPEN", position: 1, label: "Me da el nombre", targetType: "STEP", targetKey: "B0_NAMELESS_THANKS" },
  { sourceType: "STEP", sourceKey: "B0_NAMELESS_OPEN", position: 2, label: "¿Para qué es?", targetType: "STEP", targetKey: "B0_NAMELESS_PARA" },
  { sourceType: "STEP", sourceKey: "B0_NAMELESS_OPEN", position: 3, label: "Me pasa con el propietario", targetType: "STEP", targetKey: "B1_SIN_NOM" },

  { sourceType: "STEP", sourceKey: "B0_QUIEN_LLAMA", position: 1, label: "Te pasa con el propietario", targetType: "STEP", targetKey: "B1" },
  { sourceType: "STEP", sourceKey: "B0_QUIEN_LLAMA", position: 2, label: "¿De dónde llama?", targetType: "STEP", targetKey: "B0_DONDE_LLAMA" },
  { sourceType: "STEP", sourceKey: "B0_QUIEN_LLAMA", position: 3, label: "¿De parte de qué empresa?", targetType: "STEP", targetKey: "B0_EMPRESA" },
  { sourceType: "STEP", sourceKey: "B0_QUIEN_LLAMA", position: 4, label: "¿De qué tema se trata?", targetType: "STEP", targetKey: "B0_TEMA" },
  { sourceType: "STEP", sourceKey: "B0_QUIEN_LLAMA", position: 5, label: "Insiste otra vez", targetType: "STEP", targetKey: "B0_INSISTE" },
  { sourceType: "STEP", sourceKey: "B0_QUIEN_LLAMA", position: 6, label: "Sigue insistiendo", targetType: "STEP", targetKey: "B0_CLOSE" },

  { sourceType: "STEP", sourceKey: "B0_DONDE_LLAMA", position: 1, label: "Te pasa con el propietario", targetType: "STEP", targetKey: "B1" },
  { sourceType: "STEP", sourceKey: "B0_DONDE_LLAMA", position: 2, label: "¿De parte de qué empresa?", targetType: "STEP", targetKey: "B0_EMPRESA" },
  { sourceType: "STEP", sourceKey: "B0_DONDE_LLAMA", position: 3, label: "¿De qué tema se trata?", targetType: "STEP", targetKey: "B0_TEMA" },
  { sourceType: "STEP", sourceKey: "B0_DONDE_LLAMA", position: 4, label: "Insiste otra vez", targetType: "STEP", targetKey: "B0_INSISTE" },
  { sourceType: "STEP", sourceKey: "B0_DONDE_LLAMA", position: 5, label: "Sigue insistiendo", targetType: "STEP", targetKey: "B0_CLOSE" },

  { sourceType: "STEP", sourceKey: "B0_EMPRESA", position: 1, label: "Te pasa con el propietario", targetType: "STEP", targetKey: "B1" },
  { sourceType: "STEP", sourceKey: "B0_EMPRESA", position: 2, label: "¿De qué tema se trata?", targetType: "STEP", targetKey: "B0_TEMA" },
  { sourceType: "STEP", sourceKey: "B0_EMPRESA", position: 3, label: "Insiste otra vez", targetType: "STEP", targetKey: "B0_INSISTE" },
  { sourceType: "STEP", sourceKey: "B0_EMPRESA", position: 4, label: "Sigue insistiendo", targetType: "STEP", targetKey: "B0_CLOSE" },

  { sourceType: "STEP", sourceKey: "B0_TEMA", position: 1, label: "Te pasa con el propietario", targetType: "STEP", targetKey: "B1" },
  { sourceType: "STEP", sourceKey: "B0_TEMA", position: 2, label: "Insiste otra vez", targetType: "STEP", targetKey: "B0_INSISTE" },
  { sourceType: "STEP", sourceKey: "B0_TEMA", position: 3, label: "Sigue insistiendo", targetType: "STEP", targetKey: "B0_CLOSE" },

  { sourceType: "STEP", sourceKey: "B0_INSISTE", position: 1, label: "Te pasa con el propietario", targetType: "STEP", targetKey: "B1" },
  { sourceType: "STEP", sourceKey: "B0_INSISTE", position: 2, label: "Sigue insistiendo", targetType: "STEP", targetKey: "B0_CLOSE" },

  { sourceType: "STEP", sourceKey: "B1_SIN_NOM", position: 1, label: "No, dime / Tranquilo, dime", targetType: "STEP", targetKey: "B2" },
  { sourceType: "STEP", sourceKey: "B1_SIN_NOM", position: 2, label: "¿Quién eres? / ¿De parte de quién?", targetType: "STEP", targetKey: "B1_R2_KALLFLOW" },
  { sourceType: "STEP", sourceKey: "B1_SIN_NOM", position: 3, label: "Sí, ahora no puedo / reunión", targetType: "STEP", targetKey: "HORA1" },
  { sourceType: "STEP", sourceKey: "B1_SIN_NOM", position: 4, label: "¿Cómo has conseguido mi número?", targetType: "STEP", targetKey: "B1_R4_NUMERO" },

  { sourceType: "STEP", sourceKey: "B1", position: 1, label: "No, dime / No me pillas mal / Tranquilo, dime", targetType: "STEP", targetKey: "B2" },
  { sourceType: "STEP", sourceKey: "B1", position: 2, label: "¿Quién eres? / ¿De parte de quién?", targetType: "STEP", targetKey: "B1_R2_KALLFLOW" },
  { sourceType: "STEP", sourceKey: "B1", position: 3, label: "Sí, ahora no puedo / reunión", targetType: "STEP", targetKey: "HORA1" },
  { sourceType: "STEP", sourceKey: "B1", position: 4, label: "¿Cómo has conseguido mi número?", targetType: "STEP", targetKey: "B1_R4_NUMERO" },

  { sourceType: "STEP", sourceKey: "HORA1", position: 1, label: "Da una hora concreta", targetType: "STEP", targetKey: "HORA1_CONFIRM" },
  { sourceType: "STEP", sourceKey: "HORA1", position: 2, label: "Mándame un email", targetType: "OBJECTION", targetKey: "E" },

  { sourceType: "STEP", sourceKey: "B2", position: 1, label: "Sí, venga / Dime / Sí", targetType: "STEP", targetKey: "B3" },
  { sourceType: "STEP", sourceKey: "B2", position: 2, label: "No tengo tiempo ahora", targetType: "STEP", targetKey: "HORA2" },
  { sourceType: "STEP", sourceKey: "B2", position: 3, label: "¿De qué se trata? / ¿Qué vendes?", targetType: "STEP", targetKey: "B2_R3" },
  { sourceType: "STEP", sourceKey: "B2", position: 4, label: "No me interesa", targetType: "STEP", targetKey: "B2_R4_PUSH" },

  { sourceType: "STEP", sourceKey: "HORA2", position: 1, label: "Da una hora", targetType: "STEP", targetKey: "HORA2_CONFIRM" },
  { sourceType: "STEP", sourceKey: "HORA2", position: 2, label: "Mándame un email", targetType: "OBJECTION", targetKey: "E" },

  { sourceType: "STEP", sourceKey: "B2_R4_PUSH", position: 1, label: "Acepta escuchar", targetType: "STEP", targetKey: "B3" },
  { sourceType: "STEP", sourceKey: "B2_R4_PUSH", position: 2, label: "Insiste en que no", targetType: "OBJECTION", targetKey: "A" },

  { sourceType: "STEP", sourceKey: "B3", position: 1, label: "Sí, me interesa / Cuéntame más / Vale, sigue", targetType: "STEP", targetKey: "B4" },
  { sourceType: "STEP", sourceKey: "B3", position: 2, label: "¿Pero qué es exactamente? / ¿Cómo funciona?", targetType: "STEP", targetKey: "B3_Q_EXACTO" },
  { sourceType: "STEP", sourceKey: "B3", position: 3, label: "¿Por qué 60 segundos? / ¿Tan importante es?", targetType: "STEP", targetKey: "B3_Q_60" },
  { sourceType: "STEP", sourceKey: "B3", position: 4, label: "¿Esto es una IA? / ¿Es un robot?", targetType: "STEP", targetKey: "B3_Q_IA" },
  { sourceType: "STEP", sourceKey: "B3", position: 5, label: "¿Quién lo está haciendo? / ¿Otras agencias ya lo ofrecen?", targetType: "STEP", targetKey: "B3_Q_OTRAS" },

  { sourceType: "STEP", sourceKey: "B4", position: 1, label: "Va directo al cliente / email / WhatsApp", targetType: "STEP", targetKey: "B4_R1" },
  { sourceType: "STEP", sourceKey: "B4", position: 2, label: "Tenemos un CRM / Hubspot / automatización", targetType: "STEP", targetKey: "B4_R2" },
  { sourceType: "STEP", sourceKey: "B4", position: 3, label: "Eso lo decide el cliente / solo generamos el lead", targetType: "STEP", targetKey: "B4_R3" },
  { sourceType: "STEP", sourceKey: "B4", position: 4, label: "No lo sé / Mmm / silencio", targetType: "STEP", targetKey: "B4_R4" },

  { sourceType: "STEP", sourceKey: "B4_GAP", position: 1, label: "Sí, ha pasado", targetType: "STEP", targetKey: "B4_GAP_YES" },
  { sourceType: "STEP", sourceKey: "B4_GAP", position: 2, label: "No, no ha pasado", targetType: "STEP", targetKey: "B4_GAP_NO" },

  { sourceType: "STEP", sourceKey: "B45", position: 1, label: "Sí, claro / Sí, por qué no", targetType: "STEP", targetKey: "B5" },
  { sourceType: "STEP", sourceKey: "B45", position: 2, label: "¿Qué es exactamente lo que me vas a mostrar?", targetType: "STEP", targetKey: "B45_R2" },
  { sourceType: "STEP", sourceKey: "B45", position: 3, label: "No sé si me interesa / No creo que sea para nosotros", targetType: "OBJECTION", targetKey: "A" },

  { sourceType: "STEP", sourceKey: "B5", position: 1, label: "Sí, el {DIA} me va bien", targetType: "STEP", targetKey: "B5_R1_DETAILS" },
  { sourceType: "STEP", sourceKey: "B5", position: 2, label: "Esta semana no puedo", targetType: "STEP", targetKey: "B5_NEXT" },
  { sourceType: "STEP", sourceKey: "B5", position: 3, label: "No tengo la agenda ahora delante", targetType: "STEP", targetKey: "B5_R3_CAL" },
  { sourceType: "STEP", sourceKey: "B5", position: 4, label: "¿Cuánto cuesta?", targetType: "OBJECTION", targetKey: "H" },

  { sourceType: "STEP", sourceKey: "B5_NEXT", position: 1, label: "Confirma para la semana que viene", targetType: "STEP", targetKey: "B5_R1_DETAILS" },
  { sourceType: "STEP", sourceKey: "B5_NEXT", position: 2, label: "Sigue esquivando", targetType: "OBJECTION", targetKey: "D" },

  { sourceType: "STEP", sourceKey: "OA2", position: 1, label: "Sí, nos ha pasado", targetType: "STEP", targetKey: "OA2_YES_ACK" },
  { sourceType: "STEP", sourceKey: "OA2", position: 2, label: "No", targetType: "STEP", targetKey: "OA3" },

  { sourceType: "STEP", sourceKey: "OA3", position: 1, label: "Sí, ya lo ofrecemos", targetType: "STEP", targetKey: "OA3_YES_HOW" },
  { sourceType: "STEP", sourceKey: "OA3", position: 2, label: "No, eso lo gestiona el cliente", targetType: "STEP", targetKey: "OA3_NO_CLIENT" },
  { sourceType: "STEP", sourceKey: "OA3", position: 3, label: "Seguimos sin interés", targetType: "STEP", targetKey: "OA4_CLOSE" },

  { sourceType: "STEP", sourceKey: "OA3_YES_HOW", position: 1, label: "Hay gap", targetType: "STEP", targetKey: "B5" },
  { sourceType: "STEP", sourceKey: "OA3_YES_HOW", position: 2, label: "No hay gap", targetType: "STEP", targetKey: "OA4_CLOSE" },

  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PERF", position: 1, label: "Bien, sin problemas", targetType: "STEP", targetKey: "OB_B_AGENT_LT60_Q" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PERF", position: 2, label: "Regular / Podría ir mejor", targetType: "STEP", targetKey: "OB_B_AGENT_PROBLEM_Q" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PERF", position: 3, label: "Silencio / duda", targetType: "STEP", targetKey: "OB_B_AGENT_WISH_Q" },

  { sourceType: "STEP", sourceKey: "OB_B_AGENT_LT60_Q", position: 1, label: "Sí, en menos de 60 segundos", targetType: "STEP", targetKey: "OB_B_AGENT_COVERED" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_LT60_Q", position: 2, label: "No / tarda más", targetType: "STEP", targetKey: "OB_B_AGENT_GAP" },

  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PROBLEM_Q", position: 1, label: "La voz suena demasiado robótica", targetType: "STEP", targetKey: "OB_B_PROB_ROBOTIC" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PROBLEM_Q", position: 2, label: "No se integra bien con formularios / CRM", targetType: "STEP", targetKey: "OB_B_PROB_INTEGRATION" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PROBLEM_Q", position: 3, label: "Tarda demasiado en llamar / no llama al momento", targetType: "STEP", targetKey: "OB_B_PROB_SPEED" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PROBLEM_Q", position: 4, label: "Los clientes se quejan de hablar con una IA", targetType: "STEP", targetKey: "OB_B_PROB_IA" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PROBLEM_Q", position: 5, label: "Es muy caro / no vale lo que cuesta", targetType: "STEP", targetKey: "OB_B_PROB_EXPENSIVE_Q" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_PROBLEM_Q", position: 6, label: "Es complicado de configurar / gestionar", targetType: "STEP", targetKey: "OB_B_PROB_COMPLEX" },

  { sourceType: "STEP", sourceKey: "OB_B_AGENT_WISH_Q", position: 1, label: "La voz suena demasiado robótica", targetType: "STEP", targetKey: "OB_B_PROB_ROBOTIC" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_WISH_Q", position: 2, label: "No se integra bien con formularios / CRM", targetType: "STEP", targetKey: "OB_B_PROB_INTEGRATION" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_WISH_Q", position: 3, label: "Tarda demasiado en llamar / no llama al momento", targetType: "STEP", targetKey: "OB_B_PROB_SPEED" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_WISH_Q", position: 4, label: "Los clientes se quejan de hablar con una IA", targetType: "STEP", targetKey: "OB_B_PROB_IA" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_WISH_Q", position: 5, label: "Es muy caro / no vale lo que cuesta", targetType: "STEP", targetKey: "OB_B_PROB_EXPENSIVE_Q" },
  { sourceType: "STEP", sourceKey: "OB_B_AGENT_WISH_Q", position: 6, label: "Es complicado de configurar / gestionar", targetType: "STEP", targetKey: "OB_B_PROB_COMPLEX" },

  { sourceType: "STEP", sourceKey: "OD_CONFIRM", position: 1, label: "Sí, si se resuelve avanzarían", targetType: "STEP", targetKey: "B5" },
  { sourceType: "STEP", sourceKey: "OD_CONFIRM", position: 2, label: "No, hay otra objeción", targetType: "STEP", targetKey: "OD_MORE" },

  { sourceType: "STEP", sourceKey: "OE_DEMO_REDIRECT", position: 1, label: "Acepta ver la demo", targetType: "STEP", targetKey: "B5" },
  { sourceType: "STEP", sourceKey: "OE_DEMO_REDIRECT", position: 2, label: "Sigue insistiendo en email", targetType: "STEP", targetKey: "OE_FOLLOWUP" },

  { sourceType: "STEP", sourceKey: "OE_FOLLOWUP", position: 1, label: "Da una hora", targetType: "STEP", targetKey: "OE_FOLLOWUP_HOUR" },
  { sourceType: "STEP", sourceKey: "OE_FOLLOWUP", position: 2, label: "No da hora", targetType: "STEP", targetKey: "OE_FOLLOWUP_NO_HOUR" },

  { sourceType: "STEP", sourceKey: "OK_FAST_Q", position: 1, label: "Sí", targetType: "STEP", targetKey: "OK_COVERED" },
  { sourceType: "STEP", sourceKey: "OK_FAST_Q", position: 2, label: "No / no lo sé", targetType: "STEP", targetKey: "OK_GAP" },

  { sourceType: "STEP", sourceKey: "OK_VISIBILITY_Q", position: 1, label: "No tenemos visibilidad", targetType: "STEP", targetKey: "OK_VISIBILITY_NO" },
  { sourceType: "STEP", sourceKey: "OK_VISIBILITY_Q", position: 2, label: "Sí, y va bien", targetType: "STEP", targetKey: "OK_VISIBILITY_OK" },

  { sourceType: "STEP", sourceKey: "OK_OTHER_IA_Q", position: 1, label: "Sí", targetType: "STEP", targetKey: "OK_OTHER_IA_COVERED" },
  { sourceType: "STEP", sourceKey: "OK_OTHER_IA_Q", position: 2, label: "No", targetType: "STEP", targetKey: "OK_OTHER_IA_GAP" },

  { sourceType: "OBJECTION", sourceKey: "A", position: 1, label: "Es timing / ahora no", targetType: "OBJECTION", targetKey: "D" },
  { sourceType: "OBJECTION", sourceKey: "A", position: 2, label: "No ve el caso de uso", targetType: "STEP", targetKey: "OA2" },
  { sourceType: "OBJECTION", sourceKey: "A", position: 3, label: "Otra respuesta", targetType: "STEP", targetKey: "OA2" },

  { sourceType: "OBJECTION", sourceKey: "B", position: 1, label: "Email / SMS automático", targetType: "STEP", targetKey: "OB_B_EMAIL" },
  { sourceType: "OBJECTION", sourceKey: "B", position: 2, label: "Llamadas manuales", targetType: "STEP", targetKey: "OB_B_MANUAL" },
  { sourceType: "OBJECTION", sourceKey: "B", position: 3, label: "Tienen agente de voz", targetType: "STEP", targetKey: "OB_B_AGENT_SETUP" },

  { sourceType: "OBJECTION", sourceKey: "C", position: 1, label: "Me pasa con esa persona", targetType: "STEP", targetKey: "B2" },
  { sourceType: "OBJECTION", sourceKey: "C", position: 2, label: "Agendar con ambos", targetType: "STEP", targetKey: "B5" },
  { sourceType: "OBJECTION", sourceKey: "C", position: 3, label: "Me da el contacto", targetType: "STEP", targetKey: "OC_CONTACT_FOLLOWUP" },

  { sourceType: "OBJECTION", sourceKey: "D", position: 1, label: "Estamos muy ocupados", targetType: "STEP", targetKey: "OD_BUSY" },
  { sourceType: "OBJECTION", sourceKey: "D", position: 2, label: "Esperamos al próximo trimestre", targetType: "STEP", targetKey: "OD_QUARTER" },
  { sourceType: "OBJECTION", sourceKey: "D", position: 3, label: "Presupuesto / prioridades / sistema", targetType: "STEP", targetKey: "OD_CONFIRM" },

  { sourceType: "OBJECTION", sourceKey: "E", position: 1, label: "Contesta el volumen", targetType: "STEP", targetKey: "OE_DEMO_REDIRECT" },
  { sourceType: "OBJECTION", sourceKey: "E", position: 2, label: "Mándamelo y ya", targetType: "STEP", targetKey: "OE_FOLLOWUP" },

  { sourceType: "OBJECTION", sourceKey: "F", position: 1, label: "Ok, me parece bien / Sí, cuándo", targetType: "STEP", targetKey: "B5" },
  { sourceType: "OBJECTION", sourceKey: "F", position: 2, label: "¿Y tienes clientes que ya lo usen?", targetType: "STEP", targetKey: "OF_CLIENTS" },
  { sourceType: "OBJECTION", sourceKey: "F", position: 3, label: "¿Cuánto cuesta?", targetType: "OBJECTION", targetKey: "H" },
  { sourceType: "OBJECTION", sourceKey: "F", position: 4, label: "Prefiero pensármelo / No sé", targetType: "OBJECTION", targetKey: "D" },

  { sourceType: "OBJECTION", sourceKey: "G", position: 1, label: "Ir a demo", targetType: "STEP", targetKey: "B5" },

  { sourceType: "OBJECTION", sourceKey: "H", position: 1, label: "Dice el volumen", targetType: "STEP", targetKey: "OH_ACK" },

  { sourceType: "OBJECTION", sourceKey: "I", position: 1, label: "Ir a demo", targetType: "STEP", targetKey: "B5" },

  { sourceType: "OBJECTION", sourceKey: "J", position: 1, label: "Ir a demo", targetType: "STEP", targetKey: "B5" },

  { sourceType: "OBJECTION", sourceKey: "K", position: 1, label: "Sí, bastante rápido", targetType: "STEP", targetKey: "OK_FAST_Q" },
  { sourceType: "OBJECTION", sourceKey: "K", position: 2, label: "Tienen un CRM / mandan email automático", targetType: "STEP", targetKey: "OK_EMAIL" },
  { sourceType: "OBJECTION", sourceKey: "K", position: 3, label: "Tienen a alguien que llama", targetType: "STEP", targetKey: "OK_HUMAN" },
  { sourceType: "OBJECTION", sourceKey: "K", position: 4, label: "No sé, eso lo gestiona el cliente", targetType: "STEP", targetKey: "OK_VISIBILITY_Q" },
  { sourceType: "OBJECTION", sourceKey: "K", position: 5, label: "Tienen otra IA / sistema automatizado", targetType: "STEP", targetKey: "OK_OTHER_IA_Q" }
];

async function main() {
  const existing = await prisma.callScript.findUnique({
    where: { languageCode: "es" },
    select: { id: true }
  });

  const script =
    existing ??
    (await prisma.callScript.create({
      data: {
        languageCode: "es",
        isActive: true,
        name: "Guion agencias Meta/Google Ads"
      },
      select: { id: true }
    }));

  await prisma.callScriptSession.deleteMany({
    where: { scriptId: script.id }
  });

  await prisma.callScriptStepChoice.deleteMany({
    where: {
      step: { scriptId: script.id }
    }
  });
  await prisma.callScriptObjectionChoice.deleteMany({
    where: {
      objection: { scriptId: script.id }
    }
  });
  await prisma.callScriptResponse.deleteMany({
    where: {
      objection: { scriptId: script.id }
    }
  });
  await prisma.callScriptObjection.deleteMany({
    where: { scriptId: script.id }
  });
  await prisma.callScriptStep.deleteMany({
    where: { scriptId: script.id }
  });

  await prisma.callScript.update({
    where: { id: script.id },
    data: { name: "Guion agencias Meta/Google Ads", isActive: true }
  });

  const createdSteps = new Map<string, string>();
  const createdObjections = new Map<string, string>();

  for (const step of steps) {
    const created = await prisma.callScriptStep.create({
      data: {
        scriptId: script.id,
        position: step.position,
        title: step.title,
        text: step.text
      }
    });
    createdSteps.set(step.key, created.id);
  }

  for (const objection of objections) {
    const created = await prisma.callScriptObjection.create({
      data: {
        scriptId: script.id,
        position: objection.position,
        label: objection.label
      }
    });

    await prisma.callScriptResponse.create({
      data: {
        objectionId: created.id,
        position: 1,
        label: "Base",
        text: objection.responseText
      }
    });

    createdObjections.set(objection.key, created.id);
  }

  for (const step of steps) {
    if (!step.advance) continue;
    const stepId = createdSteps.get(step.key);
    if (!stepId) throw new Error(`Missing step source: ${step.key}`);

    await prisma.callScriptStep.update({
      where: { id: stepId },
      data: {
        advanceTargetType: step.advance.targetType,
        advanceTargetStepId: step.advance.targetType === "STEP" ? createdSteps.get(step.advance.targetKey ?? "") ?? null : null,
        advanceTargetObjectionId:
          step.advance.targetType === "OBJECTION" ? createdObjections.get(step.advance.targetKey ?? "") ?? null : null,
        advanceTerminalLabel: step.advance.targetType === "TERMINAL" ? step.advance.terminalLabel ?? "Final" : null
      }
    });
  }

  for (const choice of choices) {
    if (choice.sourceType === "STEP") {
      const stepId = createdSteps.get(choice.sourceKey);
      if (!stepId) throw new Error(`Missing step source: ${choice.sourceKey}`);

      await prisma.callScriptStepChoice.create({
        data: {
          stepId,
          position: choice.position,
          label: choice.label,
          targetType: choice.targetType,
          targetStepId: choice.targetType === "STEP" ? createdSteps.get(choice.targetKey ?? "") ?? null : null,
          targetObjectionId: choice.targetType === "OBJECTION" ? createdObjections.get(choice.targetKey ?? "") ?? null : null,
          terminalLabel: choice.targetType === "TERMINAL" ? choice.terminalLabel ?? "Final" : null
        }
      });
      continue;
    }

    const objectionId = createdObjections.get(choice.sourceKey);
    if (!objectionId) throw new Error(`Missing objection source: ${choice.sourceKey}`);

    await prisma.callScriptObjectionChoice.create({
      data: {
        objectionId,
        position: choice.position,
        label: choice.label,
        targetType: choice.targetType,
        targetStepId: choice.targetType === "STEP" ? createdSteps.get(choice.targetKey ?? "") ?? null : null,
        targetObjectionId: choice.targetType === "OBJECTION" ? createdObjections.get(choice.targetKey ?? "") ?? null : null,
        terminalLabel: choice.targetType === "TERMINAL" ? choice.terminalLabel ?? "Final" : null
      }
    });
  }

  console.log("Exact Spanish agency cold call script loaded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
