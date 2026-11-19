namespace Pakpost.Application.Common.Interfaces;

public sealed record SavedRequestRevisionOverview(
    int Revision,
    string Action,
    Guid ActorId,
    DateTimeOffset CreatedAt);
