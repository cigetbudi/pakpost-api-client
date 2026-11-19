namespace Pakpost.Application.Common.Interfaces;

public sealed record SavedRequestIndex(
    Guid Id,
    Guid CollectionId,
    Guid? FolderId,
    int Revision,
    string Name,
    string Method,
    string Url,
    string HeadersJson);
