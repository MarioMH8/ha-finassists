const ACTOR_KIND = {
	HOME_ASSISTANT_USER: 'home_assistant_user',
	UNKNOWN: 'unknown',
} as const;

interface HomeAssistantActor {
	displayName?: string;
	id: string;
	kind: typeof ACTOR_KIND.HOME_ASSISTANT_USER;
	username?: string;
}

interface UnknownActor {
	kind: typeof ACTOR_KIND.UNKNOWN;
}

type IngressActor = HomeAssistantActor | UnknownActor;

export { ACTOR_KIND, type HomeAssistantActor, type IngressActor, type UnknownActor };
