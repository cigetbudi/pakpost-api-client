using Microsoft.AspNetCore.SignalR;
namespace Pakpost.Api.Realtime;

public interface IWorkspaceChangePublisher
{
    Task PublishAsync(Guid workspaceId,string kind,Guid collectionId,Guid? requestId,int? revision,
        string? sourceInstance,CancellationToken ct);
}
// Publish only AFTER a successful database commit. A broken WebSocket must never
// turn a persisted mutation into a false API failure; revision checks are authoritative.
public sealed class WorkspaceChangePublisher(IHubContext<WorkspaceHub> hub, ILogger<WorkspaceChangePublisher> logger)
    : IWorkspaceChangePublisher
{
    public async Task PublishAsync(Guid workspaceId,string kind,Guid collectionId,Guid? requestId,int? revision,
        string? sourceInstance,CancellationToken ct)
    {
        try
        {
            // Correlation token, NOT authorization. Do not send request bodies/secrets.
            var origin=sourceInstance?.Length is > 0 and <= 80 ? sourceInstance : "";
            using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(3));
            await hub.Clients.Group(WorkspaceHub.GroupName(workspaceId)).SendAsync("WorkspaceChanged",new
            {
                workspaceId,kind,collectionId,requestId,revision,sourceInstance=origin
            },timeout.Token);
        }
        catch(Exception ex)
        {
            logger.LogWarning(ex,"Workspace change notification failed after mutation commit");
        }
    }
}
