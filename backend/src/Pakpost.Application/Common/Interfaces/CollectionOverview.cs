namespace Pakpost.Application.Common.Interfaces;

public sealed record CollectionOverview(Guid Id, Guid WorkspaceId, string Name, int RequestCount);
