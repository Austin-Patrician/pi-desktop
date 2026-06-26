import type { NamedExtensionFactory } from "../resource-loader.ts";
import planModeExtension from "./plan-mode.ts";
import questionnaire from "./questionnaire.ts";
import subagent from "./subagent.ts";
import { getBuiltinSubagentPromptTemplates } from "./subagent-assets.ts";

const BUILTIN_EXTENSION_FACTORIES: NamedExtensionFactory[] = [
	{
		name: "questionnaire",
		factory: questionnaire,
	},
	{
		name: "plan-mode",
		factory: planModeExtension,
	},
	{
		name: "subagent",
		factory: subagent,
	},
];

export function getBuiltinExtensionFactories(): NamedExtensionFactory[] {
	return [...BUILTIN_EXTENSION_FACTORIES];
}

export function getBuiltinPromptTemplates() {
	return [...getBuiltinSubagentPromptTemplates()];
}
