using Microsoft.AspNetCore.Http.Timeouts;
using Pakpost.Api.Extensions;
using Pakpost.Api.Health;
using Pakpost.Api.Middlewares;
using Pakpost.Api.Realtime;
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

builder.Services.AddApplication();
builder.Services.AddMediatorServices();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddWorkbenchWebServices(builder.Configuration);
builder.Services.AddPakpostHealthChecks();
builder.Services.AddPakpostRequestTimeouts(builder.Configuration);

var app = builder.Build();

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
app.UseAuthorization();

app.MapControllers();
app.MapHub<WorkspaceHub>("/hubs/workspace").DisableRequestTimeout();
app.MapPakpostHealthChecks();

app.Run();
