import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { styles } from '../styles';

//@ts-ignore
export function SearchableSelect({ options, value, onChange, placeholder = "Select..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredOptions, setFilteredOptions] = useState(options);
    const containerRef = useRef(null);

    useEffect(() => {
        const filtered = options.filter((option: any) =>
            option.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredOptions(filtered);
    }, [searchTerm, options]);

    useEffect(() => {
        function handleClickOutside(event: any) {
            const container = containerRef.current as unknown as HTMLElement;
            if (container && container.contains && !container.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option: any) => {
        onChange(option);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div style={styles.selectContainer as any} ref={containerRef}>
            <div
                style={styles.selectDisplay as any}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{value || placeholder}</span>
                <span style={styles.arrow as any}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
                <div style={styles.dropdown as any}>
                    <input
                        style={styles.searchInput as any}
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    <div style={styles.optionsList as any}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option: any, index: any) => (
                                <div
                                    key={index}
                                    style={{
                                        ...styles.option,
                                        ...(value === option ? styles.selectedOption : {})
                                    } as any}
                                    onClick={() => handleSelect(option)}
                                >
                                    {option}
                                </div>
                            ))
                        ) : (
                            <div style={styles.noOptions as any}>No options found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
