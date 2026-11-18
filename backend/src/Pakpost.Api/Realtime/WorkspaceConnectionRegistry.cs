using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace Pakpost.Api.Realtime;

// Per-process connection registry. When roles are changed, remove the affected
// user's active connections from the workspace group immediately. The DB remains
// the source of authorization; use a distributed strategy when scaling API replicas.
public sealed class WorkspaceConnectionRegistry(ILogger<WorkspaceConnectionRegistry> logger)
{
    private readonly ConcurrentDictionary<string,(Guid UserId,Guid WorkspaceId)> _connections=new();
    public void Register(string connectionId,Guid userId,Guid workspaceId)
        => _connections[connectionId]=(userId,workspaceId);
    public void Remove(string connectionId)=>_connections.TryRemove(connectionId,out _);
    public async Task RevokeWorkspaceAsync(
        IHubContext<WorkspaceHub> hub,
        Guid workspaceId)
    {
        foreach (var pair in _connections)
        {
            if (pair.Value.WorkspaceId != workspaceId)
            {
                continue;
            }

            if (!_connections.TryRemove(pair.Key, out _))
            {
                continue;
            }

            try
            {
                await hub.Groups.RemoveFromGroupAsync(
                    pair.Key,
                    WorkspaceHub.GroupName(workspaceId));

                await hub.Clients.Client(pair.Key).SendAsync(
                    "WorkspaceAccessChanged",
                    new { workspaceId });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to revoke a deleted workspace connection");
            }
        }
    }

    public async Task ReauthorizeUserAsync(IHubContext<WorkspaceHub> hub,Guid workspaceId,Guid userId)
    {
        foreach(var pair in _connections)
        {
            if(pair.Value.UserId!=userId||pair.Value.WorkspaceId!=workspaceId)continue;
            try
            {
                await hub.Groups.RemoveFromGroupAsync(pair.Key,WorkspaceHub.GroupName(workspaceId));
                await hub.Clients.Client(pair.Key).SendAsync("WorkspaceAccessChanged",new{workspaceId});
            }
            catch(Exception ex)
            {
                // A disconnected client must not make a committed role change look failed.
                logger.LogWarning(ex,"Failed to reauthorize a disconnected Workspace hub connection");
            }
        }
    }
}
