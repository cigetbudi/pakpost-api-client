using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IRequestEnvironmentRepository
{
    Task<IReadOnlyList<RequestEnvironment>> ListAsync(Guid workspaceId, CancellationToken ct);
    Task<RequestEnvironment?> FindAsync(Guid id, CancellationToken ct);
    void Add(RequestEnvironment environment);
    void Remove(RequestEnvironment environment);
    void AddVariable(RequestEnvironmentVariable variable);
    void RemoveVariable(RequestEnvironmentVariable variable);
}
