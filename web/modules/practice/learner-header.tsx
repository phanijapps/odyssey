import { FlatStandard, Mode } from "./types";

type LearnerHeaderProps = {
  grades: string[];
  subjects: string[];
  selGrade: string;
  selSubject: string;
  searchQuery: string;
  searchResults: FlatStandard[];

  mode: Mode;
  browseOpen: boolean;
  role: "student" | "admin" | null;
  testLocked: boolean;
  onSubjectChange: (subject: string) => void;
  onGradeChange: (grade: string) => void;
  onSearchQueryChange: (query: string) => void;

  onSearchResultSelect: (skill: FlatStandard) => void;
  onModeChange: (mode: Mode) => void;
  onBrowseToggle: () => void;
  onSignOut: () => Promise<void>;
};

/** Controls learner navigation without owning practice or assessment state. */
export function LearnerHeader({
  grades,
  subjects,
  selGrade,
  selSubject,
  searchQuery,
  searchResults,

  mode,
  browseOpen,
  role,
  testLocked,
  onSubjectChange,
  onGradeChange,
  onSearchQueryChange,

  onSearchResultSelect,
  onModeChange,
  onBrowseToggle,
  onSignOut,
}: LearnerHeaderProps) {
  return (
    <header className="ixl-topbar">
      <span className="small-mark">O</span>
      <span className="topbar-brand">odyssey</span>
      <select
        className="topbar-select"
        value={selSubject}
        disabled={testLocked}
        onChange={(event) => onSubjectChange(event.target.value)}
      >
        {subjects.map((subject) => (
          <option key={subject} value={subject}>
            {subject === "Mathematics"
              ? "Math"
              : subject === "English Language Arts"
                ? "ELA"
                : subject}
          </option>
        ))}
      </select>
      <select
        className="topbar-select"
        value={selGrade}
        disabled={testLocked}
        onChange={(event) => onGradeChange(event.target.value)}
      >
        {grades.map((grade) => (
          <option key={grade} value={grade}>
            {grade}
          </option>
        ))}
      </select>
      <div className="topbar-search">
        <input
          type="text"
          placeholder="Search skills…"
          value={searchQuery}
          disabled={testLocked}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        {searchQuery.trim() && (
          <div className="search-dropdown">
            {searchResults.length > 0 ? (
              searchResults.map((skill) => (
                <button
                  key={skill.id}
                  className="search-result-row"
                  disabled={testLocked}
                  onClick={() => onSearchResultSelect(skill)}
                >
                  <span className="result-code">{skill.standardCode}</span>
                  <span className="result-text">{skill.standardText}</span>
                </button>
              ))
            ) : (
              <p className="search-meta">
                No matches. Try different words, or pick a skill below.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="mode-toggle">
        <button
          className={mode === "practice" ? "mode-btn active" : "mode-btn"}
          onClick={() => onModeChange("practice")}
          disabled={testLocked}
        >
          Practice
        </button>
        <button
          className={mode === "test" ? "mode-btn active" : "mode-btn"}
          onClick={() => onModeChange("test")}
          disabled={testLocked}
        >
          Test
        </button>
      </div>
      <button
        className="browse-toggle"
        onClick={onBrowseToggle}
        disabled={testLocked}
      >
        {browseOpen ? "Hide skills" : "Browse skills"}
      </button>
      <a href="/performance" className="ixl-link">
        Performance
      </a>
      {role === "admin" && (
        <a href="/dashboard" className="ixl-link">
          Dashboard
        </a>
      )}
      {role && <span className="role-chip">{role}</span>}
      <button className="ixl-link" onClick={onSignOut}>
        Sign out
      </button>
    </header>
  );
}
