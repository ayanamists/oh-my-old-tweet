import { Sema } from 'async-sema';
import { createContext } from 'react';

const SemaContext = createContext(new Sema(5));

export default SemaContext;