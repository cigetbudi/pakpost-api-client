using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Pakpost.Api.Extensions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;

namespace Pakpost.Api.Realtime;

// Groups never confer access: re-check the DB membership before joining.
[Authorize]
public sealed class WorkspaceHub(IWorkspaceRepository workspaces,WorkspaceConnectionRegistry registry) : Hub
{
    public static string GroupName(Guid workspaceId) => $"workspace:{workspaceId:N}";
    public async Task JoinWorkspace(Guid workspaceId)
    {
        if(workspaceId == Guid.Empty) throw new HubException("Invalid workspace");
        await WorkspacePermissions.RequireAsync(workspaces,workspaceId,Context.User!.GetUserId(),
            WorkspacePermissions.CollectionRead,Context.ConnectionAborted);
        var target=GroupName(workspaceId);
        if(Context.Items.TryGetValue("workspace",out var previous) && previous is string old && old!=target)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId,old,Context.ConnectionAborted);
        await Groups.AddToGroupAsync(Context.ConnectionId,target,Context.ConnectionAborted);
        Context.Items["workspace"]=target;
        registry.Register(Context.ConnectionId,Context.User!.GetUserId(),workspaceId);
    }
    public override Task OnDisconnectedAsync(Exception? exception)
    {
        registry.Remove(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
