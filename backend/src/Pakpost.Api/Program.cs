using Microsoft.AspNetCore.Http.Timeouts;
using Pakpost.Api.Extensions;
using Pakpost.Api.Health;
using Pakpost.Api.Middlewares;
using Pakpost.Api.Realtime;
using Pakpost.Api.Security;
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;
using Pakpost.Application;
using Pakpost.Infrastructure;
using Pakpost.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(options =>
{
    options.IncludeScopes = true;
    options.UseUtcTimestamp = true;
    options.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
});

// Trust X-Forwarded-Proto only from configured reverse-proxy IP addresses.
// Do NOT enable blanket forwarded-header trust on a public interface.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedProto;
    foreach (var entry in builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [])
        if (IPAddress.TryParse(entry, out var ip)) options.KnownProxies.Add(ip);
});

builder.Services.AddApplication();
builder.Services.AddMediatorServices();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddWorkbenchWebServices(builder.Configuration);
builder.Services.AddPakpostHealthChecks();
builder.Services.AddPakpostRequestTimeouts(builder.Configuration);

var app = builder.Build();

app.UseForwardedHeaders();

_ = app.Services.GetRequiredService<WorkspaceCryptography>();

app.UseMiddleware<RequestCorrelationMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseRouting();
app.UseRequestTimeouts();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseMiddleware<PrivateApiCacheMiddleware>();
app.UseMiddleware<ProxyConcurrencyMiddleware>();
app.UseAuthentication();
app.UseMiddleware<BrowserSessionSecurityMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHub<WorkspaceHub>("/hubs/workspace", options =>
    options.CloseOnAuthenticationExpiration = true).DisableRequestTimeout();
app.MapPakpostHealthChecks();

app.Run();
