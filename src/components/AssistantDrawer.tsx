import React, { useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { useControlCentre } from '../context/ControlCentreContext.tsx';

const SUGGESTED_PROMPTS = [
  'Summarize the highest-priority simulated conflict right now.',
  'Why is RailRaksha not a certified SIL-4 / Kavach system?',
  'Explain how RailRadar quota & cache safeguards work.',
  'What are the tradeoffs between AI Advisory pacing and Safety-First Hold?',
];

export const AssistantDrawer: React.FC = () => {
  const {
    assistantOpen,
    setAssistantOpen,
    assistantMessages,
    assistantLoading,
    sendAssistantPrompt,
  } = useControlCentre();

  const [input, setInput] = useState('');

  if (!assistantOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || assistantLoading) return;
    const prompt = input;
    setInput('');
    await sendAssistantPrompt(prompt);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60"
      onClick={() => setAssistantOpen(false)}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-[#1C2C47] bg-[#080F1D]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#1C2C47] px-5 py-4">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-sky-400">
              <Bot className="h-3.5 w-3.5" />
              <span>ADVISORY ASSISTANT · CONTEXT-GROUNDED</span>
            </div>
            <h2 className="mt-0.5 font-display text-base font-bold text-white">
              RailRaksha Intelligence Assistant
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Grounded on live structured state. Never invents external train telemetry or executes dispatch commands.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAssistantOpen(false)}
            className="cursor-pointer rounded border border-[#1C2C47] p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
          {assistantMessages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg border p-3.5 ${
                msg.role === 'user'
                  ? 'ml-8 border-sky-500/35 bg-[#11213D] text-slate-100'
                  : 'mr-4 border-[#1C2C47] bg-[#0C1424] text-slate-200'
              }`}
            >
              <div className="whitespace-pre-line leading-relaxed">
                {msg.content}
              </div>
              {msg.role === 'assistant' && msg.provider && (
                <div className="mt-2 font-mono text-[10px] text-slate-500">
                  {msg.provider} · {msg.provenance ?? 'DERIVED_ESTIMATE'}
                </div>
              )}
            </div>
          ))}
          {assistantLoading && (
            <div className="mr-4 rounded-lg border border-[#1C2C47] bg-[#0C1424] p-3 font-mono text-[11px] text-sky-300">
              Evaluating structured corridor telemetry...
            </div>
          )}
        </div>

        {/* Suggested Prompts */}
        <div className="border-t border-[#142038] px-4 py-2.5">
          <div className="mb-1.5 font-mono text-[10px] text-slate-500">
            SUGGESTED QUERIES
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendAssistantPrompt(q)}
                disabled={assistantLoading}
                className="cursor-pointer rounded border border-[#1C2C47] bg-[#0C1424] px-2 py-1 text-left text-[11px] text-slate-300 hover:border-sky-500/50 hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-[#1C2C47] p-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about active conflicts, SHAP factors, quota..."
            className="flex-1 rounded border border-[#1C2C47] bg-[#060B14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={assistantLoading || !input.trim()}
            className="inline-flex cursor-pointer items-center justify-center rounded bg-sky-500 p-2 text-[#040911] hover:bg-sky-400 disabled:opacity-40"
            aria-label="Send assistant question"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </aside>
    </div>
  );
};
