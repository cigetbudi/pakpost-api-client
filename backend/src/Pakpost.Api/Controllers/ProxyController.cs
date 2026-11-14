using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pakpost.Application.Internal.Requests;
namespace Pakpost.Api.Controllers;
[ApiController,Route("api/proxy")]
public sealed class ProxyController(ISender sender):ControllerBase
{
    // Public by design: no login needed to try an HTTP request.
    [HttpPost("send"),AllowAnonymous,EnableRateLimiting("public-proxy")]
    [RequestSizeLimit(150_000)]
    public async Task<ActionResult<SendHttpResponse>> Send(SendHttpRequestCommand command,CancellationToken ct)
        =>Ok(await sender.Send(command,ct));
}
