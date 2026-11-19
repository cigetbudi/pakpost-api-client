namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record SavedRequestIndexDto(
    Guid Id,
    Guid CollectionId,
    string Name,
    string Method,
    string Url,
    string HeadersJson,
    int Revision,
    Guid? FolderId,
    bool IsIndex = true);
