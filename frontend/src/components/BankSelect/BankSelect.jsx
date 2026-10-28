import { useEffect, useMemo, useRef, useState } from "react";
import { MAJOR_BANKS } from "./banks";
import "./BankSelect.css";

/**
 * Searchable bank dropdown that also accepts any typed bank name.
 *
 * Props:
 *  value     - current bank name (string)
 *  onChange  - (string) => void
 *  placeholder, id, name, disabled
 */
export default function BankSelect({
  value = "",
  onChange,
  placeholder = "Select or type bank name",
  id,
  name,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const query = value.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      query
        ? MAJOR_BANKS.filter((b) => b.toLowerCase().includes(query))
        : MAJOR_BANKS,
    [query]
  );

  const exactMatch = MAJOR_BANKS.some((b) => b.toLowerCase() === query);
  const showCustom = query && !exactMatch;

  // Options shown in the list (custom entry goes last)
  const options = showCustom ? [...filtered, value.trim()] : filtered;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keep highlighted option in view
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    const el = listRef.current.children[active];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (bank) => {
    onChange(bank);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="bank-select" ref={wrapRef}>
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        className="bank-select__input"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        className="bank-select__toggle"
        aria-label="Show banks"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && !disabled && (
        <ul className="bank-select__list" role="listbox" ref={listRef}>
          {options.length === 0 && (
            <li className="bank-select__empty">Start typing to add a bank</li>
          )}
          {options.map((bank, i) => {
            const isCustom = showCustom && i === options.length - 1;
            return (
              <li
                key={bank + i}
                role="option"
                aria-selected={i === active}
                className={
                  "bank-select__option" +
                  (i === active ? " is-active" : "") +
                  (isCustom ? " is-custom" : "")
                }
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep input focus
                  choose(bank);
                }}
              >
                {isCustom ? `Add "${bank}"` : bank}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}