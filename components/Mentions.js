"use client";

import { useEffect, useRef, useState } from "react";
import { filterMentions, mentionAtCaret, splitMentions } from "@/lib/mentions";

export function MentionText({ text, people = [], className = "" }) {
  return (
    <p className={className}>
      {splitMentions(text, people).map((part, index) => part.type === "mention" ? (
        part.kind === "bot" ? (
          <a key={index} className="mention-chip" href={`/bots#bot-${part.slug}`}>@{part.slug}</a>
        ) : (
          <span key={index} className="mention-chip">@{part.slug}</span>
        )
      ) : (
        <span key={index}>{part.text}</span>
      ))}
    </p>
  );
}

export function MentionField({
  as = "input",
  people = [],
  value,
  onChange,
  ...rest
}) {
  const field = useRef(null);
  const [open, setOpen] = useState(false);

  function grow(el) {
    if (!el || el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    grow(field.current);
  }, [value]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const choices = filterMentions(people, query);
  const Tag = as;

  function sync(next, caret) {
    onChange(next);
    const token = mentionAtCaret(next, caret);
    if (!token) {
      setOpen(false);
      return;
    }
    setQuery(token.query);
    setActive(0);
    setOpen(true);
  }

  function insert(choice) {
    const el = field.current;
    const caret = el?.selectionStart ?? value.length;
    const token = mentionAtCaret(value, caret);
    if (!token) return;
    const next = `${value.slice(0, token.start)}@${choice.slug} ${value.slice(token.end)}`;
    onChange(next);
    setOpen(false);
    const pos = token.start + choice.slug.length + 2;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(event) {
    if (!open || !choices.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % choices.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + choices.length) % choices.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insert(choices[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="mention-field">
      <Tag
        {...rest}
        ref={field}
        value={value}
        onChange={(event) => sync(event.target.value, event.target.selectionStart)}
        onInput={(event) => grow(event.currentTarget)}
        onKeyDown={onKeyDown}
      />
      {open && choices.length ? (
        <ul className="mention-menu" role="listbox">
          {choices.map((choice, index) => (
            <li key={`${choice.kind}-${choice.slug}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insert(choice);
                }}
              >
                <strong>@{choice.slug}</strong>
                <span>{choice.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
