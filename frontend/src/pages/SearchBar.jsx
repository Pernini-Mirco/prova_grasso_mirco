import { useState } from 'react';

export default function SearchBar({ placeholder = 'Cerca...', onSearch }) {
  const [value, setValue] = useState('');

  function handleChange(e) {
    const val = e.target.value;
    setValue(val);
    onSearch(val);
  }

  return (
    <div className="search-bar">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="search-bar-input"
      />
    </div>
  );
}
