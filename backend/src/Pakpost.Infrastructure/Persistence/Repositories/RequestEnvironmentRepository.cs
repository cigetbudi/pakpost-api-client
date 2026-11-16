using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class RequestEnvironmentRepository(PakpostDbContext db) : IRequestEnvironmentRepository
{
    public async Task<IReadOnlyList<RequestEnvironment>> ListAsync(Guid workspaceId,CancellationToken ct)
        => await db.RequestEnvironments.Include(x=>x.Variables).Where(x=>x.WorkspaceId==workspaceId).OrderBy(x=>x.Name).ToListAsync(ct);
    public Task<RequestEnvironment?> FindAsync(Guid id,CancellationToken ct)
        => db.RequestEnvironments.Include(x=>x.Variables).FirstOrDefaultAsync(x=>x.Id==id,ct);
    public void Add(RequestEnvironment environment)=>db.RequestEnvironments.Add(environment);
    public void Remove(RequestEnvironment environment)=>db.RequestEnvironments.Remove(environment);
    // Explicit tracking matters: child GUIDs are assigned by the domain constructor.
    // Attaching them through an existing parent can otherwise mark them Modified, not Added.
    public void AddVariable(RequestEnvironmentVariable variable)=>db.RequestEnvironmentVariables.Add(variable);
    public void RemoveVariable(RequestEnvironmentVariable variable)=>db.RequestEnvironmentVariables.Remove(variable);
}
