using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class RequestEnvironmentRepository(PakpostDbContext db) : IRequestEnvironmentRepository
{
    public async Task<IReadOnlyList<RequestEnvironment>> ListAsync(Guid workspaceId, CancellationToken ct)
    {
        var environments = await db.RequestEnvironments
            .AsNoTracking()
            .Include(environment => environment.Variables)
            .Where(environment => environment.WorkspaceId == workspaceId)
            .OrderBy(environment => environment.Name)
            .ToListAsync(ct);

        foreach (var environment in environments)
        {
            foreach (var variable in environment.Variables)
            {
                await db.DecryptEnvironmentVariableAsync(variable, environment.WorkspaceId, ct);
            }
        }

        return environments;
    }

    public async Task<RequestEnvironment?> FindAsync(Guid id, CancellationToken ct)
    {
        var environment = await db.RequestEnvironments
            .Include(item => item.Variables)
            .FirstOrDefaultAsync(item => item.Id == id, ct);

        if (environment is not null)
        {
            foreach (var variable in environment.Variables)
            {
                await db.DecryptEnvironmentVariableAsync(variable, environment.WorkspaceId, ct);
            }
        }

        return environment;
    }

    public void Add(RequestEnvironment environment) => db.RequestEnvironments.Add(environment);

    public void Remove(RequestEnvironment environment) => db.RequestEnvironments.Remove(environment);

    public void AddVariable(RequestEnvironmentVariable variable) =>
        db.RequestEnvironmentVariables.Add(variable);

    public void RemoveVariable(RequestEnvironmentVariable variable) =>
        db.RequestEnvironmentVariables.Remove(variable);
}
