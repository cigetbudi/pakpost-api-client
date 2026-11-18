using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record SavedRequestDto(Guid Id, Guid CollectionId, string Name, string Method, string Url, string HeadersJson, string Body,
    string BodyMode, string ContentType, string FormFieldsJson, string PreRequestScript, string PostResponseScript, int Revision, Guid? FolderId = null);
