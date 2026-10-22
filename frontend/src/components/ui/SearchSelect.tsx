import {
  useState,
  useRef,
  useEffect,
  useId,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  icon?: ReactNode;
  group?: string;
  keywords?: string[];
}

export interface SearchSelectProps {
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  error?: string | null;
  hint?: string;
  className?: string;
  ariaLabel?: string;
  renderOption?: (option: SelectOption, isSelected: boolean) => ReactNode;
  renderSelected?: (option: SelectOption) => ReactNode;
  filterOption?: (option: SelectOption, search: string) => boolean;
  searchable?: boolean;
  compact?: boolean;
  minMenuWidth?: number;
}

export function SearchSelect({
  id: explicitId,
  name,
  label,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  loading = false,
  clearable = false,
  onClear,
  error,
  hint,
  className = "",
  ariaLabel,
  renderOption,
  renderSelected,
  filterOption,
  searchable = true,
  compact = false,
  minMenuWidth,
}: SearchSelectProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const listboxId = `${id}-listbox`;
  const searchInputId = `${id}-search`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    placeAbove: false,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value) || (value ? { value, label: value } : null);

  // Filter options based on search term
  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    if (filterOption) return filterOption(opt, searchTerm);
    const term = searchTerm.toLowerCase().trim();
    if (opt.label.toLowerCase().includes(term)) return true;
    if (opt.value.toLowerCase().includes(term)) return true;
    if (opt.subLabel && opt.subLabel.toLowerCase().includes(term)) return true;
    if (opt.group && opt.group.toLowerCase().includes(term)) return true;
    if (opt.keywords && opt.keywords.some((kw) => kw.toLowerCase().includes(term))) return true;
    return false;
  });

  // Calculate coordinates for portal dropdown to prevent container clipping
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 280; // approximate max dropdown height
    const roomBelow = window.innerHeight - rect.bottom;
    const placeAbove = roomBelow < dropdownHeight && rect.top > dropdownHeight;

    setCoords({
      top: placeAbove ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      placeAbove,
    });
  }, []);

  const openMenu = () => {
    if (disabled || loading) return;
    updateCoords();
    setIsOpen(true);
    setSearchTerm("");
    // Find initial active index
    const initialIndex = filteredOptions.findIndex((opt) => opt.value === value);
    setActiveIndex(initialIndex >= 0 ? initialIndex : 0);
  };

  const closeMenu = (returnFocus = true) => {
    setIsOpen(false);
    setSearchTerm("");
    setActiveIndex(-1);
    if (returnFocus && triggerRef.current) {
      triggerRef.current.focus();
    }
  };

  // Focus search input or menu when menu opens
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
      // Small timeout to ensure DOM element exists in portal
      const t = setTimeout(() => {
        if (searchable) {
          searchInputRef.current?.focus();
        } else {
          menuRef.current?.focus();
        }
      }, 20);
      return () => {
        clearTimeout(t);
        window.removeEventListener("resize", updateCoords);
        window.removeEventListener("scroll", updateCoords, true);
      };
    }
  }, [isOpen, updateCoords, searchable]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        closeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation on trigger button
  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  };

  // Keyboard navigation inside search/listbox
  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
      return;
    }

    if (e.key === "Tab") {
      closeMenu(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      return;
    }

    if (e.key === "Enter" || (!searchable && e.key === " ")) {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        const selected = filteredOptions[activeIndex];
        onChange(selected.value);
        closeMenu(true);
      }
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
      return;
    }
  };

  // Auto-scroll active option into view
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const optionEl = document.getElementById(`${listboxId}-opt-${activeIndex}`);
    if (optionEl && typeof optionEl.scrollIntoView === "function") {
      optionEl.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, activeIndex, listboxId]);

  // Reset active index when search term changes
  useEffect(() => {
    setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
  }, [searchTerm, filteredOptions.length]);

  const activeOption = activeIndex >= 0 && activeIndex < filteredOptions.length ? filteredOptions[activeIndex] : null;

  // Group options if grouped
  const hasGroups = filteredOptions.some((o) => !!o.group);
  const groupedOptions: { groupName?: string; items: { option: SelectOption; index: number }[] }[] = [];

  if (hasGroups) {
    const groupsMap = new Map<string, { option: SelectOption; index: number }[]>();
    filteredOptions.forEach((opt, idx) => {
      const gName = opt.group || "Other";
      if (!groupsMap.has(gName)) groupsMap.set(gName, []);
      groupsMap.get(gName)!.push({ option: opt, index: idx });
    });
    for (const [groupName, items] of groupsMap.entries()) {
      groupedOptions.push({ groupName, items });
    }
  } else {
    groupedOptions.push({
      items: filteredOptions.map((opt, idx) => ({ option: opt, index: idx })),
    });
  }

  return (
    <div className={`search-select-container ${className} ${compact ? "is-compact" : ""} ${disabled ? "is-disabled" : ""}`}>
      {label && (
        <label htmlFor={id} className="search-select-label">
          {label}
          {required && <span className="field-required-asterisk" aria-hidden="true"> *</span>}
        </label>
      )}

      {/* Hidden input for form submissions */}
      {name && <input type="hidden" name={name} value={value || ""} />}

      <div className="search-select-control-wrap">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={`search-select-trigger ${error ? "has-error" : ""} ${isOpen ? "is-open" : ""}`}
          onClick={() => (isOpen ? closeMenu() : openMenu())}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled || loading}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={activeOption ? `${listboxId}-opt-${activeIndex}` : undefined}
          aria-label={ariaLabel || label || placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        >
          <span className="search-select-content">
            {selectedOption ? (
              renderSelected ? (
                renderSelected(selectedOption)
              ) : (
                <span className="search-select-value">
                  {selectedOption.icon && <span className="search-select-icon">{selectedOption.icon}</span>}
                  <span className="search-select-text">{selectedOption.label}</span>
                </span>
              )
            ) : (
              <span className="search-select-placeholder">{placeholder}</span>
            )}
          </span>

          <span className="search-select-actions">
            {clearable && selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={0}
                className="search-select-clear-btn"
                aria-label="Clear selection"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClear) onClear();
                  onChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onClear) onClear();
                    onChange("");
                  }
                }}
              >
                ✕
              </span>
            )}
            <span className={`search-select-chevron ${isOpen ? "is-flipped" : ""}`} aria-hidden="true">
              ▾
            </span>
          </span>
        </button>
      </div>

      {hint && !error && (
        <span id={`${id}-hint`} className="search-select-hint">
          {hint}
        </span>
      )}

      {error && (
        <span id={`${id}-error`} className="search-select-error" role="alert">
          {error}
        </span>
      )}

      {/* Portal Dropdown Menu */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            tabIndex={searchable ? -1 : 0}
            className={`search-select-portal-menu ${compact ? "is-compact" : ""} ${coords.placeAbove ? "place-above" : "place-below"}`}
            style={{
              position: "fixed",
              top: coords.placeAbove ? undefined : `${coords.top + 4}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top + 4}px` : undefined,
              left: `${coords.left}px`,
              width: `${Math.max(coords.width, minMenuWidth ?? (searchable ? 240 : 130))}px`,
              zIndex: 9999,
              outline: "none",
            }}
            onKeyDown={handleMenuKeyDown}
          >
            {searchable && (
              <div className="search-select-search-box">
                <input
                  ref={searchInputRef}
                  id={searchInputId}
                  type="text"
                  className="search-select-search-input"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  aria-label={searchPlaceholder}
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="search-select-search-clear"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search text"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            <ul
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              className="search-select-listbox"
              aria-label={label || placeholder}
            >
              {filteredOptions.length === 0 ? (
                <li className="search-select-empty" role="presentation">
                  No matching options
                </li>
              ) : (
                groupedOptions.map((group, gIdx) => (
                  <li key={group.groupName || gIdx} role="presentation">
                    {group.groupName && (
                      <div className="search-select-group-header" role="presentation">
                        {group.groupName}
                      </div>
                    )}
                    <ul role="group" aria-label={group.groupName} className="search-select-subgroup">
                      {group.items.map(({ option, index }) => {
                        const isSelected = option.value === value;
                        const isHighlighted = index === activeIndex;
                        return (
                          <li
                            key={option.value}
                            id={`${listboxId}-opt-${index}`}
                            role="option"
                            aria-selected={isSelected}
                            className={`search-select-option ${isSelected ? "is-selected" : ""} ${
                              isHighlighted ? "is-highlighted" : ""
                            }`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => {
                              onChange(option.value);
                              closeMenu(true);
                            }}
                          >
                            {renderOption ? (
                              renderOption(option, isSelected)
                            ) : (
                              <div className="search-select-option-inner">
                                {option.icon && (
                                  <span className="search-select-option-icon" aria-hidden="true">
                                    {option.icon}
                                  </span>
                                )}
                                <div className="search-select-option-text-wrap">
                                  <span className="search-select-option-label">{option.label}</span>
                                  {option.subLabel && (
                                    <span className="search-select-option-sublabel">{option.subLabel}</span>
                                  )}
                                </div>
                                {isSelected && (
                                  <span className="search-select-check" aria-hidden="true">
                                    ✓
                                  </span>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
