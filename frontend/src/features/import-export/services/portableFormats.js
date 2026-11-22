/** Stable API for optional portable formats (OpenAPI 3.x and Insomnia v4).
 * Imports treat scripts as inert data and never fetch external $ref files.
 */
export {parseOpenApiCollection} from './openApiCollectionFormat.js';
export {parseInsomniaV4,exportInsomniaV4Collection} from './insomniaCollectionFormat.js';
