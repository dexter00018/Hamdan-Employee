'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Check, ChevronDown, Info, LoaderCircle, Plus, Sparkles, X } from 'lucide-react';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';

type Message = { id: string; role: 'user' | 'assistant'; text: string; error?: boolean };
const subscribe = () => () => {};
export default function EmployeeAskAI() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || active.current) return;
    const controller = new AbortController(); active.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 110_000);
    setQuestion(''); setBusy(true);
    setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', text: trimmed }]);
    try {
      const response = await fetch('/api/employee-ask-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ question: trimmed, language: 'auto', history: messages.filter(message => !message.error).slice(-8).map(message => ({ role: message.role, content: message.text.slice(0, 1000) })) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'I couldn’t answer just now. Please try again.');
      if (!controller.signal.aborted) setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', text: data.answer }]);
    } catch (error) {
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', error: true, text: controller.signal.aborted ? 'That took longer than expected. Please try again.' : error instanceof Error ? error.message : 'I couldn’t answer just now. Please try again.' }]);
    } finally { window.clearTimeout(timer); active.current = null; setBusy(false); input.current?.focus(); }
  };
  if (!mounted) return null;
  return createPortal(<div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[48] font-sans lg:bottom-6 lg:right-6">
    {open && <section id={panelId} role="dialog" aria-labelledby={titleId} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }} className="absolute bottom-[72px] right-0 flex h-[min(620px,calc(100dvh-12rem))] w-[min(410px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white text-slate-900 shadow-[0_24px_90px_-18px_rgba(0,0,0,0.35)] dark:border-[#39443e] dark:bg-[#18241f] dark:text-[#f1f5f3] lg:h-[min(660px,calc(100dvh-8rem))]">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <span className="relative grid size-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><Sparkles size={21} /><span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border-2 border-white bg-emerald-600 text-white dark:border-[#18241f]"><Check size={8} strokeWidth={3} /></span></span>
        <div className="flex-1"><h2 id={titleId} className="text-sm font-bold tracking-tight">Ask AI</h2><p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#a8b9af]">Your employee assistant</p></div>
        <button type="button" disabled={busy || !messages.length} onClick={() => { setMessages([]); setQuestion(''); input.current?.focus(); }} aria-label="New conversation" title="New conversation" className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:text-[#a8b9af] dark:hover:bg-white/5"><Plus size={18} /></button>
        <button type="button" onClick={close} aria-label="Minimize Ask AI" className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-[#a8b9af] dark:hover:bg-white/5"><ChevronDown size={20} /></button>
      </header>
      <Conversation className="min-h-0 flex-1" aria-label="Ask AI messages">
        <ConversationContent className="gap-5 p-5">
          {messages.length === 0 && <div className="flex flex-col items-start pb-4 pt-7">
            <span className="mb-5 grid size-14 place-items-center rounded-[20px] bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 dark:from-emerald-500/20 dark:to-teal-500/10 dark:text-emerald-300"><Sparkles size={28} strokeWidth={1.5} /></span>
            <h3 className="text-[23px] font-semibold tracking-tight">Hi! How can I help?</h3>
            <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-slate-500 dark:text-[#a8b9af]">Ask me about your attendance, leave, or payslip.</p>
            <div className="mt-7 flex w-full flex-col gap-2">
              {['Ilan pa ang leave ko?', 'Ano ang deductions sa latest payslip ko?'].map(prompt => <button type="button" key={prompt} onClick={() => void send(prompt)} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-xs font-medium transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5"><span>{prompt}</span><ArrowUp size={14} className="shrink-0 rotate-45 text-slate-400" /></button>)}
            </div>
          </div>}
          {messages.map(message => <div key={message.id} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
            {message.role === 'assistant' && <span className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"><Sparkles size={12} /> Ask AI</span>}
            <div className={`max-w-[92%] whitespace-pre-wrap break-words rounded-[20px] px-4 py-3 text-[13px] leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-emerald-700 text-white' : 'rounded-tl-md bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-[#e1ebe5]'}`} role={message.error ? 'alert' : undefined}>
              {message.text}
            </div>
          </div>)}
          {busy && <div role="status" className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#a8b9af]"><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" />Thinking…</div>}
        </ConversationContent>
        <ConversationScrollButton className="border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
      </Conversation>
      <footer className="shrink-0 border-t border-slate-100 bg-white p-4 dark:border-white/10 dark:bg-[#18241f]">
        {privacy && <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-[#a8b9af]">Only your own private records are available. Your question and up to 8 recent messages are sent to n8n and Google Gemini for context. Payslip questions send your PDF to n8n and Google Gemini. Answers can contain mistakes; check the original payslip.</p>}
        <form onSubmit={event => { event.preventDefault(); void send(question); }} className="flex items-end gap-2 rounded-[20px] border border-slate-200 bg-slate-50 p-2 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 dark:border-white/15 dark:bg-white/[0.035]">
          <textarea ref={input} aria-label="Message Ask AI" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(question); } }} maxLength={500} rows={2} placeholder="Ask me anything about your work…" className="max-h-28 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[13px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-[#f1f5f3]" />
          <button type="submit" disabled={busy || !question.trim()} aria-label="Send message" className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-slate-600">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowUp size={19} />}</button>
        </form>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-400"><span>Ask naturally, in English or Filipino</span><button type="button" aria-expanded={privacy} onClick={() => setPrivacy(value => !value)} className="flex items-center gap-1 rounded px-1 py-1 hover:text-slate-600 dark:hover:text-slate-200"><Info size={11} />Privacy</button></div>
      </footer>
    </section>}
    <button ref={launcher} type="button" onClick={() => open ? close() : setOpen(true)} aria-label={open ? 'Close Ask AI' : 'Open Ask AI'} aria-expanded={open} aria-controls={open ? panelId : undefined} className="group relative ml-auto flex size-16 items-center justify-center rounded-[22px] border border-emerald-300/30 bg-gradient-to-br from-emerald-500 via-emerald-700 to-teal-900 text-white shadow-[0_10px_32px_-6px_rgba(4,120,87,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_36px_-6px_rgba(4,120,87,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 motion-reduce:transform-none">
      {open ? <X size={25} /> : <>
        <svg aria-hidden="true" viewBox="0 0 48 48" className="size-11 drop-shadow-sm" fill="none">
          <path d="M24 12V8" stroke="#D1FAE5" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="6" r="3" fill="#A7F3D0" />
          <rect x="5" y="23" width="5" height="10" rx="2.5" fill="#D1FAE5" />
          <rect x="38" y="23" width="5" height="10" rx="2.5" fill="#D1FAE5" />
          <rect x="9" y="13" width="30" height="28" rx="11" fill="#ECFDF5" />
          <rect x="12.5" y="18" width="23" height="17" rx="7" fill="#064E3B" />
          <rect x="17" y="23" width="3.5" height="5" rx="1.75" fill="#A7F3D0" />
          <rect x="27.5" y="23" width="3.5" height="5" rx="1.75" fill="#A7F3D0" />
          <path d="M21 30.5C22.7 32 25.3 32 27 30.5" stroke="#6EE7B7" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M19 37.5H29" stroke="#A7F3D0" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="pointer-events-none absolute right-[76px] whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-white/10 dark:bg-[#18241f] dark:text-[#e1ebe5]">Ask AI</span>
      </>}
    </button>
  </div>, document.body);
}
