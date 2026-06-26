import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentSessionServices } from "../src/core/agent-session-services.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";

describe("builtin questionnaire extension", () => {
	let tempDir: string;
	let agentDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-builtin-extensions-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("loads questionnaire by default when creating services", async () => {
		const services = await createAgentSessionServices({
			cwd: tempDir,
			agentDir,
			resourceLoaderOptions: {
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		});

		const questionnaireExtension = services.resourceLoader
			.getExtensions()
			.extensions.find((extension) => extension.tools.has("questionnaire"));

		expect(questionnaireExtension).toBeDefined();
		expect(questionnaireExtension?.path).toBe("<builtin:questionnaire>");
		expect(
			services.resourceLoader.getExtensions().extensions.some((extension) => extension.commands.has("plan")),
		).toBe(true);
		expect(
			services.resourceLoader.getExtensions().extensions.some((extension) => extension.tools.has("subagent")),
		).toBe(true);
	});

	it("skips builtin questionnaire for noExtensions but keeps caller inline extensions", async () => {
		const services = await createAgentSessionServices({
			cwd: tempDir,
			agentDir,
			resourceLoaderOptions: {
				noExtensions: true,
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
				extensionFactories: [
					(pi) => {
						pi.registerTool({
							name: "custom_inline_tool",
							label: "Custom Inline Tool",
							description: "Caller-provided inline tool",
							parameters: Type.Object({}),
							execute: async () => ({
								content: [{ type: "text", text: "ok" }],
								details: {},
							}),
						});
					},
				],
			},
		});

		const extensions = services.resourceLoader.getExtensions().extensions;
		expect(extensions.some((extension) => extension.tools.has("questionnaire"))).toBe(false);
		expect(extensions.some((extension) => extension.tools.has("subagent"))).toBe(false);
		expect(extensions.some((extension) => extension.tools.has("custom_inline_tool"))).toBe(true);
		expect(extensions.find((extension) => extension.tools.has("custom_inline_tool"))?.path).toBe("<inline:1>");
		expect(services.resourceLoader.getPrompts().prompts.some((prompt) => prompt.name === "implement")).toBe(false);
	});

	it("registers questionnaire in the default createAgentSession path", async () => {
		const sessionManager = SessionManager.inMemory(tempDir);
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			sessionManager,
		});

		expect(session.getToolDefinition("questionnaire")).toBeDefined();
		expect(session.getToolDefinition("subagent")).toBeDefined();
		expect(session.getActiveToolNames()).toContain("questionnaire");
		expect(session.getActiveToolNames()).toContain("subagent");
		expect(session.getAllTools().find((tool) => tool.name === "questionnaire")?.sourceInfo.path).toBe(
			"<builtin:questionnaire>",
		);
		expect(session.getAllTools().find((tool) => tool.name === "subagent")?.sourceInfo.path).toBe(
			"<builtin:subagent>",
		);
		session.dispose();
	});

	it("registers plan-mode command and flag in the default createAgentSession path", async () => {
		const sessionManager = SessionManager.inMemory(tempDir);
		const { session, extensionsResult } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			sessionManager,
		});

		await session.bindExtensions({});

		expect(session.extensionRunner.getCommand("plan")?.description).toBe("Toggle plan mode (read-only exploration)");
		expect(extensionsResult.runtime.flagValues.get("plan")).toBe(false);
		session.dispose();
	});

	it("toggles built-in plan mode through /plan", async () => {
		const sessionManager = SessionManager.inMemory(tempDir);
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			sessionManager,
		});

		await session.bindExtensions({});

		expect(session.getActiveToolNames()).toEqual(["read", "bash", "edit", "write", "questionnaire", "subagent"]);

		await session.prompt("/plan");
		expect(session.getActiveToolNames()).toEqual(["read", "bash", "questionnaire", "grep", "find", "ls"]);

		await session.prompt("/plan");
		expect(session.getActiveToolNames()).toEqual(["read", "bash", "edit", "write", "questionnaire", "subagent"]);

		session.dispose();
	});

	it("starts in plan mode when the built-in --plan flag is set", async () => {
		const services = await createAgentSessionServices({
			cwd: tempDir,
			agentDir,
			extensionFlagValues: new Map([["plan", true]]),
			resourceLoaderOptions: {
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		});

		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			sessionManager: SessionManager.inMemory(tempDir),
			resourceLoader: services.resourceLoader,
		});

		await session.bindExtensions({});
		expect(session.getActiveToolNames()).toEqual(["read", "bash", "questionnaire", "grep", "find", "ls"]);
		session.dispose();
	});

	it("keeps builtin prompts when extensions are enabled and drops them when noPromptTemplates is true", async () => {
		const services = await createAgentSessionServices({
			cwd: tempDir,
			agentDir,
			resourceLoaderOptions: {
				noSkills: true,
				noThemes: true,
			},
		});

		expect(services.resourceLoader.getPrompts().prompts.some((prompt) => prompt.name === "implement")).toBe(true);
		expect(services.resourceLoader.getPrompts().prompts.find((prompt) => prompt.name === "implement")?.filePath).toBe(
			"<builtin:subagent/prompts/implement.md>",
		);
		expect(
			services.resourceLoader.getPrompts().prompts.some((prompt) => prompt.name === "implement-and-review"),
		).toBe(true);

		const noPromptsServices = await createAgentSessionServices({
			cwd: tempDir,
			agentDir,
			resourceLoaderOptions: {
				noSkills: true,
				noThemes: true,
				noPromptTemplates: true,
			},
		});

		expect(noPromptsServices.resourceLoader.getPrompts().prompts).toEqual([]);
	});
});
