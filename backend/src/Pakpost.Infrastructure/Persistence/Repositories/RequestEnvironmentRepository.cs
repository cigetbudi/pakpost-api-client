using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class RequestEnvironmentRepository(PakpostDbContext db) : IRequestEnvironmentRepository
{
    public async Task<IReadOnlyList<RequestEnvironment>> ListAsync(Guid workspaceId, CancellationToken ct) =>
        await db.RequestEnvironments
            .AsNoTracking()
            .Include(environment => environment.Variables)
            .Where(environment => environment.WorkspaceId == workspaceId)
            .OrderBy(environment => environment.Name)
            .ToListAsync(ct);

    public Task<RequestEnvironment?> FindAsync(Guid id, CancellationToken ct) =>
        db.RequestEnvironments
            .Include(environment => environment.Variables)
            .FirstOrDefaultAsync(environment => environment.Id == id, ct);

    public void Add(RequestEnvironment environment) => db.RequestEnvironments.Add(environment);

    public void Remove(RequestEnvironment environment) => db.RequestEnvironments.Remove(environment);

    public void AddVariable(RequestEnvironmentVariable variable) =>
        db.RequestEnvironmentVariables.Add(variable);

    public void RemoveVariable(RequestEnvironmentVariable variable) =>
        db.RequestEnvironmentVariables.Remove(variable);
}
