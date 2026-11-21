using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class WorkspaceCapacity(PakpostDbContext db) : IWorkspaceCapacity
{
    public async Task<ITransactionScope> LockAsync(Guid workspaceId, CancellationToken ct)
    {
        var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        try
        {
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.Transaction = transaction.GetDbTransaction();
            command.CommandText = "SELECT 1 FROM organization.workspaces WHERE \"Id\" = @workspaceId FOR UPDATE";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "workspaceId";
            parameter.Value = workspaceId;
            command.Parameters.Add(parameter);
            if (await command.ExecuteScalarAsync(ct) is null)
                throw AppException.NotFound("Workspace not found");
            return new EfTransactionScope(transaction);
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    public Task<int> CountMembersAsync(Guid workspaceId, CancellationToken ct) =>
        db.WorkspaceMembers.CountAsync(member => member.WorkspaceId == workspaceId, ct);

    public async Task<int> CountReservedSeatsAsync(Guid workspaceId, DateTimeOffset now, CancellationToken ct)
    {
        var members = await CountMembersAsync(workspaceId, ct);
        // Pending invitations reserve a seat, except where that email is already a member.
        var reserved = await db.WorkspaceInvitations
            .Where(invitation => invitation.WorkspaceId == workspaceId &&
                invitation.AcceptedAt == null && invitation.RevokedAt == null && invitation.ExpiresAt > now &&
                !db.WorkspaceMembers.Any(member => member.WorkspaceId == workspaceId &&
                    db.Users.Any(user => user.Id == member.UserId && user.Email == invitation.Email)))
            .Select(invitation => invitation.Email)
            .Distinct()
            .CountAsync(ct);
        return members + reserved;
    }
}
