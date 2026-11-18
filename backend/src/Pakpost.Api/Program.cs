using Pakpost.Api.Extensions;
using Pakpost.Api.Middlewares;
using Pakpost.Api.Realtime;
using Pakpost.Application;
using Pakpost.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddMediatorServices();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddWorkbenchWebServices(builder.Configuration);

var app = builder.Build();

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseRouting();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseMiddleware<PrivateApiCacheMiddleware>();
app.UseMiddleware<ProxyConcurrencyMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<WorkspaceHub>("/hubs/workspace");
app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "pakpost-api",
    mode = "anonymous-tester-with-private-workspaces"
}));

app.Run();
