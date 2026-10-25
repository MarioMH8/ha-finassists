const ACTOR_KIND = {
	HOME_ASSISTANT_INTEGRATION: 'home_assistant_integration',
	HOME_ASSISTANT_USER: 'home_assistant_user',
	UNKNOWN: 'unknown',
} as const;

interface HomeAssistantActor {
	displayName?: string;
	id: string;
	kind: typeof ACTOR_KIND.HOME_ASSISTANT_USER;
	username?: string;
}

interface HomeAssistantIntegrationActor {
	id: string;
	kind: typeof ACTOR_KIND.HOME_ASSISTANT_INTEGRATION;
}

interface UnknownActor {
	kind: typeof ACTOR_KIND.UNKNOWN;
}

type IngressActor = HomeAssistantActor | HomeAssistantIntegrationActor | UnknownActor;

export {
	ACTOR_KIND,
	type HomeAssistantActor,
	type HomeAssistantIntegrationActor,
	type IngressActor,
	type UnknownActor,
};
