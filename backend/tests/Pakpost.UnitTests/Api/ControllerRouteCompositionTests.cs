using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.RateLimiting;
using Pakpost.Api.Controllers;

namespace Pakpost.UnitTests;

/// <summary>
/// The read-side / write-side controller extraction must never change existing
/// browser routes or weaken cookie-auth authorization.
/// </summary>
public sealed class ControllerRouteCompositionTests
{
    private const string RequestsPath =
        "api/workspaces/{workspaceId:guid}/collections/{collectionId:guid}/requests";
    private const string CreatorsPath = "api/admin/platform/creator-invitations";

    [Fact]
    public void SavedRequestReadAndWriteActionsPreserveRoutesAndAuthentication()
    {
        var expected = new (Type Controller, string Verb, string? Template, string Method)[]
        {
            (typeof(SavedRequestReadController), "GET", null, "List"),
            (typeof(SavedRequestReadController), "GET", "index", "Index"),
            (typeof(SavedRequestReadController), "GET", "index/page", "Page"),
            (typeof(SavedRequestReadController), "GET", "{requestId:guid}", "Detail"),
            (typeof(SavedRequestReadController), "GET", "{requestId:guid}/history", "History"),
            (typeof(SavedRequestReadController), "GET", "{requestId:guid}/history/{revision:int}", "HistoryDetail"),
            (typeof(SavedRequestsController), "POST", null, "Save"),
            (typeof(SavedRequestsController), "PUT", "{requestId:guid}", "Update"),
            (typeof(SavedRequestsController), "POST", "{requestId:guid}/history/{revision:int}/restore", "Restore"),
            (typeof(SavedRequestsController), "PATCH", "{requestId:guid}/reorder", "Reorder"),
            (typeof(SavedRequestsController), "PATCH", "{requestId:guid}/move", "Move"),
            (typeof(SavedRequestsController), "DELETE", "{requestId:guid}", "Delete"),
        };
        foreach (var (controller, verb, template, methodName) in expected)
        {
            Assert.NotNull(controller.GetCustomAttribute<AuthorizeAttribute>());
            Assert.Equal(RequestsPath, controller.GetCustomAttribute<RouteAttribute>()?.Template);
            var method = controller.GetMethod(methodName) ??
                throw new InvalidOperationException($"Missing action {controller.Name}.{methodName}");
            var http = method.GetCustomAttributes<HttpMethodAttribute>().Single();
            Assert.Equal(template, http.Template);
            Assert.Contains(verb, http.HttpMethods);
        }

        // Each original route is present once, not duplicated by two controllers.
        var actual = new[] {typeof(SavedRequestReadController), typeof(SavedRequestsController)}
            .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .SelectMany(method => method.GetCustomAttributes<HttpMethodAttribute>()
                    .Select(attribute => $"{string.Join(",", attribute.HttpMethods)}:{attribute.Template}")))
            .ToArray();
        Assert.Equal(expected.Length, actual.Length);
        Assert.Equal(actual.Length, actual.Distinct().Count());
    }

    [Fact]
    public void CreatorInvitationAcceptanceRemainsAuthorizedAndRateLimited()
    {
        var controller = typeof(PlatformCreatorInvitationAcceptanceController);
        Assert.NotNull(controller.GetCustomAttribute<AuthorizeAttribute>());
        Assert.Equal(CreatorsPath, controller.GetCustomAttribute<RouteAttribute>()?.Template);
        var method = controller.GetMethod("Accept") ??
            throw new InvalidOperationException("Creator invitation acceptance action is missing");
        Assert.Equal("accept", method.GetCustomAttribute<HttpPostAttribute>()?.Template);
        Assert.NotNull(method.GetCustomAttribute<EnableRateLimitingAttribute>());
        Assert.Null(typeof(PlatformCreatorInvitationsController).GetMethod("Accept"));
    }
}
