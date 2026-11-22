/** Compatibility facade for the request editor; keep old named exports stable. */
export {BODY_FORMATS,bodyFormat,languageFromMime} from './requestBodyFormats.js';
export {resolveVars,resolveRows} from './requestVariableResolution.js';
export {syntaxProblem,formatSource} from './requestSourceFormatting.js';
export {buildCommand,GENERATORS,generateCode} from './requestCodeGeneration.js';
