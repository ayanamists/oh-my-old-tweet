const className = (...arr: any[]) => ({ className: arr.filter(Boolean).join(' ') });

export default className;
