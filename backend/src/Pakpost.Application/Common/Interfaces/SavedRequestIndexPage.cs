namespace Pakpost.Application.Common.Interfaces;

public sealed record SavedRequestIndexPage(
    IReadOnlyList<SavedRequestIndex> Items,
    string? NextCursor,
    bool HasMore);
