namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record SavedRequestIndexPageDto(
    IReadOnlyList<SavedRequestIndexDto> Items,
    string? NextCursor,
    bool HasMore);
