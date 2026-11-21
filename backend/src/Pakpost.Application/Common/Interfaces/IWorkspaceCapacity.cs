namespace Pakpost.Application.Common.Interfaces;

public interface IWorkspaceCapacity
{
    // Serializes member/invitation changes on one workspace across all API instances.
    Task<ITransactionScope> LockAsync(Guid workspaceId, CancellationToken ct);
    Task<int> CountMembersAsync(Guid workspaceId, CancellationToken ct);
    Task<int> CountReservedSeatsAsync(Guid workspaceId, DateTimeOffset now, CancellationToken ct);
}
